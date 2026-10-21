import {
  actorFromProfile,
  buildErrorMetadata,
  createRequestId,
  jsonWithActivityLog
} from '@/features/activity-logs/api/log.server';
import { requireSession } from '@/features/auth/api/session.server';
import {
  deleteQuickRequestNote,
  updateQuickRequestNote
} from '@/features/quick-request/api/service.server';
import {
  QUICK_REQUEST_NOTE_MESSAGES,
  quickRequestNoteBodySchema
} from '@/features/quick-request/schemas/quick-request-note';
import {
  QUICK_REQUEST_NOTE_TARGET,
  logQuickRequestAuthFailure,
  parseQuickRequestNoteId,
  readJsonBody,
  zodIssuesToValidationErrors
} from '../../_utils';

type Params = { params: Promise<{ id: string }> };

function fallbackLabel(rawId: string): string {
  return `특이사항 #${rawId}`;
}

export async function PATCH(request: Request, { params }: Params) {
  const requestId = createRequestId();
  const { id: rawId } = await params;
  const httpPath = `/api/quick-request/notes/${rawId}`;
  const action = 'quick_request.note_update' as const;

  const session = await requireSession();
  if (!session.ok) {
    return logQuickRequestAuthFailure({
      requestId,
      action,
      targetType: QUICK_REQUEST_NOTE_TARGET,
      targetLabel: fallbackLabel(rawId),
      httpMethod: 'PATCH',
      httpPath,
      response: session.response
    });
  }

  const logBase = {
    ...actorFromProfile(session.profile),
    action,
    targetType: QUICK_REQUEST_NOTE_TARGET,
    targetUserId: session.userId,
    httpMethod: 'PATCH',
    httpPath
  };

  const id = parseQuickRequestNoteId(rawId);
  if (!id) {
    return jsonWithActivityLog(
      requestId,
      {
        ...logBase,
        targetLabel: fallbackLabel(rawId),
        metadata: buildErrorMetadata('not_found', QUICK_REQUEST_NOTE_MESSAGES.notFound)
      },
      { success: false, message: QUICK_REQUEST_NOTE_MESSAGES.notFound },
      404
    );
  }

  const json = await readJsonBody(request);
  if (!json.ok) {
    return jsonWithActivityLog(
      requestId,
      {
        ...logBase,
        targetLabel: fallbackLabel(rawId),
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
        targetLabel: fallbackLabel(rawId),
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
    const result = await updateQuickRequestNote(session.userId, id, label);

    if (!result.ok) {
      const isNotFound = result.reason === 'not_found';
      const message = isNotFound
        ? QUICK_REQUEST_NOTE_MESSAGES.notFound
        : QUICK_REQUEST_NOTE_MESSAGES.duplicate;
      return jsonWithActivityLog(
        requestId,
        {
          ...logBase,
          targetLabel: isNotFound ? fallbackLabel(rawId) : label,
          metadata: buildErrorMetadata(isNotFound ? 'not_found' : 'duplicate_label', message)
        },
        { success: false, message },
        isNotFound ? 404 : 409
      );
    }

    return jsonWithActivityLog(
      requestId,
      {
        ...logBase,
        targetLabel: result.note.label,
        metadata: {
          changed_fields: result.previousLabel === result.note.label ? [] : ['label']
        }
      },
      {
        success: true,
        data: { note: result.note, previousLabel: result.previousLabel }
      },
      200
    );
  } catch (error) {
    console.error('[quick-request/notes/[id]] update failed:', error);
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

export async function DELETE(_request: Request, { params }: Params) {
  const requestId = createRequestId();
  const { id: rawId } = await params;
  const httpPath = `/api/quick-request/notes/${rawId}`;
  const action = 'quick_request.note_delete' as const;

  const session = await requireSession();
  if (!session.ok) {
    return logQuickRequestAuthFailure({
      requestId,
      action,
      targetType: QUICK_REQUEST_NOTE_TARGET,
      targetLabel: fallbackLabel(rawId),
      httpMethod: 'DELETE',
      httpPath,
      response: session.response
    });
  }

  const logBase = {
    ...actorFromProfile(session.profile),
    action,
    targetType: QUICK_REQUEST_NOTE_TARGET,
    targetUserId: session.userId,
    httpMethod: 'DELETE',
    httpPath
  };

  const id = parseQuickRequestNoteId(rawId);
  if (!id) {
    return jsonWithActivityLog(
      requestId,
      {
        ...logBase,
        targetLabel: fallbackLabel(rawId),
        metadata: buildErrorMetadata('not_found', QUICK_REQUEST_NOTE_MESSAGES.notFound)
      },
      { success: false, message: QUICK_REQUEST_NOTE_MESSAGES.notFound },
      404
    );
  }

  try {
    const result = await deleteQuickRequestNote(session.userId, id);

    if (!result.ok) {
      return jsonWithActivityLog(
        requestId,
        {
          ...logBase,
          targetLabel: fallbackLabel(rawId),
          metadata: buildErrorMetadata('not_found', QUICK_REQUEST_NOTE_MESSAGES.notFound)
        },
        { success: false, message: QUICK_REQUEST_NOTE_MESSAGES.notFound },
        404
      );
    }

    return jsonWithActivityLog(
      requestId,
      {
        ...logBase,
        targetLabel: result.label,
        metadata: {}
      },
      { success: true, data: { id: result.id, label: result.label } },
      200
    );
  } catch (error) {
    console.error('[quick-request/notes/[id]] delete failed:', error);
    return jsonWithActivityLog(
      requestId,
      {
        ...logBase,
        targetLabel: fallbackLabel(rawId),
        metadata: buildErrorMetadata('internal_error', QUICK_REQUEST_NOTE_MESSAGES.internalError)
      },
      { success: false, message: QUICK_REQUEST_NOTE_MESSAGES.internalError },
      500
    );
  }
}
