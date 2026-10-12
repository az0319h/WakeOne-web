import { createRequestId } from "@/features/activity-logs/api/log.server";

export function newBenefitRequestId(): string {
  return createRequestId();
}

export function getBenefitImportToken(request: Request): string | null {
  const authorization = request.headers.get("authorization");
  if (authorization?.startsWith("Bearer ")) {
    return authorization.slice("Bearer ".length).trim();
  }
  return request.headers.get("x-benefit-import-token")?.trim() || null;
}

export function isValidBenefitImportToken(token: string | null): boolean {
  const expected = process.env.BENEFIT_IMPORT_TOKEN;
  return Boolean(expected && token && token === expected);
}

export const benefitServiceActor = {
  actorUserId: null,
  actorEmail: "gmail-benefit-automation",
  actorDisplayName: "Gmail Benefit Automation",
} as const;
