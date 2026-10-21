import { NextResponse } from 'next/server';
import {
  actorFromProfile,
  buildErrorMetadata,
  createRequestId,
  jsonWithActivityLog
} from '@/features/activity-logs/api/log.server';
import { requireSession } from '@/features/auth/api/session.server';
import {
  createQuickRequestNote,
  listQuickRequestNotes
} from '@/features/quick-request/api/service.server';
import {
  QUICK_REQUEST_NOTE_MESSAGES,
  quickRequestNoteBodySchema
} from '@/features/quick-request/schemas/quick-request-note';
import {
  QUICK_REQUEST_NOTE_TARGET,
  logQuickRequestAuthFailure,
  readJsonBody,
  zodIssuesToValidationErrors
} from '../_utils';

const HTTP_PATH = '/api/quick-request/notes';
const ACTION = 'quick_request.note_create' as const;
const FALLBACK_TARGET_LABEL = '특이사항';

/** Read — activity log Out (plan 87) */
export async function GET() {
  const session = await requireSession();
  if (!session.ok) {
    return session.response;
  }

  try {
    const notes = await listQuickRequestNotes(session.userId);
    return NextResponse.json({ success: true, data: { notes } });
  } catch (error) {
    console.error('[quick-request/notes] list failed:', error);
    return NextResponse.json(
      { success: false, message: QUICK_REQUEST_NOTE_MESSAGES.internalError },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const requestId = createRequestId();
  const session = await requireSession();

  if (!session.ok) {
    return logQuickRequestAuthFailure({
      requestId,
      action: ACTION,
      targetType: QUICK_REQUEST_NOTE_TARGET,
      targetLabel: FALLBACK_TARGET_LABEL,
      httpMethod: 'POST',
      httpPath: HTTP_PATH,
      response: session.response
    });
  }

  const logBase = {
    ...actorFromProfile(session.profile),
    action: ACTION,
    targetType: QUICK_REQUEST_NOTE_TARGET,
    targetUserId: session.userId,
    httpMethod: 'POST',
    httpPath: HTTP_PATH
  };

  const json = await readJsonBody(request);
  if (!json.ok) {
    return jsonWithActivityLog(
      requestId,
      {
        ...logBase,
        targetLabel: FALLBACK_TARGET_LABEL,
        metadata: buildErrorMetadata('validation', QUICK_REQUEST_NOTE_MESSAGES.invalidBody)
      },
      { success: false, message: QUICK_REQUEST_NOTE_MESSAGES.invalidBody },
      400
    );
  }

  const parsed = quickRequestNoteBodySchema.safeParse(json.body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? QUICK_REQUEST_NOTE_MESSAGES.labelRequired;
    return jsonWithActivityLog(
      requestId,
      {
        ...logBase,
        targetLabel: FALLBACK_TARGET_LABEL,
        metadata: buildErrorMetadata('validation', message, {
          validation_errors: zodIssuesToValidationErrors(parsed.error)
        })
      },
      { success: false, message },
      400
    );
  }

  const label = parsed.data.label;

  try {
    const result = await createQuickRequestNote(session.userId, label);

    if (!result.ok) {
      const isLimit = result.reason === 'limit_exceeded';
      const message = isLimit
        ? QUICK_REQUEST_NOTE_MESSAGES.limitExceeded
        : QUICK_REQUEST_NOTE_MESSAGES.duplicate;
      return jsonWithActivityLog(
        requestId,
        {
          ...logBase,
          targetLabel: label,
          metadata: buildErrorMetadata(isLimit ? 'limit_exceeded' : 'duplicate_label', message)
        },
        { success: false, message },
        409
      );
    }

    return jsonWithActivityLog(
      requestId,
      {
        ...logBase,
        targetLabel: result.note.label,
        metadata: { changed_fields: ['label'] }
      },
      { success: true, data: { note: result.note } },
      201
    );
  } catch (error) {
    console.error('[quick-request/notes] create failed:', error);
    return jsonWithActivityLog(
      requestId,
      {
        ...logBase,
        targetLabel: label,
        metadata: buildErrorMetadata('internal_error', QUICK_REQUEST_NOTE_MESSAGES.internalError)
      },
      { success: false, message: QUICK_REQUEST_NOTE_MESSAGES.internalError },
      500
    );
  }
}
