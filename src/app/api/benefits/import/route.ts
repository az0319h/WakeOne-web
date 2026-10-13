import { NextRequest } from "next/server";
import {
  ANONYMOUS_ACTOR,
  buildErrorMetadata,
  jsonWithActivityLog,
} from "@/features/activity-logs/api/log.server";
import type { ActivityAction, ActivityLogMetadata } from "@/features/activity-logs/api/types";
import {
  importBenefitDocument,
  recordBenefitImportEvent,
} from "@/features/benefits/api/service.server";
import {
  benefitImportSchema,
  normalizeBenefitDocumentNumber,
} from "@/features/benefits/api/validators";
import { insertBenefitImportNotifications } from "@/features/notifications/api/fan-out.server";
import {
  benefitServiceActor,
  getBenefitImportToken,
  isValidBenefitImportToken,
  newBenefitRequestId,
} from "../_utils";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

async function logResponse(input: {
  requestId: string;
  action: ActivityAction;
  status: number;
  body: unknown;
  actor?: typeof benefitServiceActor | typeof ANONYMOUS_ACTOR;
  documentNumber?: string | null;
  targetUserId?: string | null;
  metadata?: ActivityLogMetadata;
}) {
  return jsonWithActivityLog(
    input.requestId,
    {
      ...(input.actor ?? benefitServiceActor),
      action: input.action,
      targetType: "benefit",
      targetUserId: input.targetUserId ?? null,
      targetLabel: `benefit:${input.documentNumber ?? "unknown"}`,
      httpMethod: "POST",
      httpPath: "/api/benefits/import",
      metadata: input.metadata,
    },
    input.body,
    input.status,
  );
}

async function tryRecordFailure(input: {
  requestId: string;
  documentNumber?: string | null;
  taskKey?: string | null;
  errorCode: string;
  message: string;
}) {
  try {
    await recordBenefitImportEvent({
      requestId: input.requestId,
      documentNumber: input.documentNumber,
      taskKey: input.taskKey,
      status: "failed",
      errorCode: input.errorCode,
      errorMessage: input.message,
    });
  } catch (error) {
    console.error("[benefits/import] failed to record event", error);
  }
}

export async function POST(request: NextRequest) {
  const requestId = newBenefitRequestId();
  if (!isValidBenefitImportToken(getBenefitImportToken(request))) {
    const message = "유효한 복지비 import token이 필요합니다.";
    return logResponse({
      requestId,
      action: "benefit.import_failed",
      status: 401,
      body: { success: false, message },
      actor: ANONYMOUS_ACTOR,
      metadata: buildErrorMetadata("unauthenticated", message),
    });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    const message = "요청 JSON을 해석할 수 없습니다.";
    await tryRecordFailure({ requestId, errorCode: "validation", message });
    return logResponse({
      requestId,
      action: "benefit.import_failed",
      status: 400,
      body: { success: false, message },
      metadata: buildErrorMetadata("validation", message),
    });
  }

  const raw = asRecord(body);
  const parsed = benefitImportSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "입력값이 올바르지 않습니다.";
    const documentNumber = typeof raw?.document_number === "string" ? raw.document_number : null;
    const taskKey = typeof raw?.task_key === "string" ? raw.task_key : null;
    await tryRecordFailure({
      requestId,
      documentNumber,
      taskKey,
      errorCode: "validation",
      message,
    });
    return logResponse({
      requestId,
      action: "benefit.import_failed",
      status: 400,
      body: { success: false, message },
      documentNumber,
      metadata: buildErrorMetadata("validation", message, {
        task_key: taskKey ?? undefined,
      }),
    });
  }

  const payload = {
    ...parsed.data,
    document_number: normalizeBenefitDocumentNumber(parsed.data.document_number),
  };

  try {
    const result = await importBenefitDocument(payload, requestId);
    const created = result.status === "created";

    if (created) {
      const applicantUserId = result.document.applicant_user_id;
      if (applicantUserId) {
        try {
          if (
            process.env.NODE_ENV !== "production" &&
            result.document.document_number.includes("FANOUT-FAIL")
          ) {
            throw new Error("E2E simulated benefit notification fan-out failure");
          }

          await insertBenefitImportNotifications({
            benefitDocumentId: result.document.id,
            documentNumber: result.document.document_number,
            benefitType: result.document.benefit_type,
            applicantUserId,
            applicantName: result.document.applicant_name,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unknown error";
          console.error("[benefits/import] notification fan-out failed", message);
        }
      }
    }

    const status = created ? 201 : 200;
    const message = created
      ? "복지비 문서가 import되었습니다."
      : "이미 import된 복지비 문서입니다.";
    return logResponse({
      requestId,
      action: created ? "benefit.import_create" : "benefit.import_duplicate",
      status,
      body: { success: true, message, status: result.status, document: result.document },
      documentNumber: result.document.document_number,
      metadata: {
        document_number: result.document.document_number,
        task_key: result.document.task_key,
        benefit_type: result.document.benefit_type,
        status: result.status,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "복지비 import 중 오류가 발생했습니다.";
    const identityError = message.includes("이름이 일치하지") || message.includes("동명이인");
    await tryRecordFailure({
      requestId,
      documentNumber: payload.document_number,
      taskKey: payload.task_key,
      errorCode: identityError ? "profile_match" : "internal_error",
      message,
    });
    return logResponse({
      requestId,
      action: "benefit.import_failed",
      status: identityError ? 422 : 500,
      body: { success: false, message },
      documentNumber: payload.document_number,
      metadata: buildErrorMetadata(identityError ? "validation" : "internal_error", message, {
        document_number: payload.document_number,
        task_key: payload.task_key,
        benefit_type: payload.benefit_type,
      }),
    });
  }
}
