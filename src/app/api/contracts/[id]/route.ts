import { NextRequest, NextResponse } from 'next/server';
import { actorFromProfile, buildErrorMetadata, jsonWithActivityLog } from '@/features/activity-logs/api/log.server';
import { requireAdminSession } from '@/features/auth/api/session.server';
import {
  getContractById,
  softDeleteContractDocument,
  updateContractDocument
} from '@/features/contracts/api/service.server';
import { contractUpdateSchema } from '@/features/contracts/api/validators';
import {
  contractTargetLabel,
  logContractAuthFailure,
  newContractRequestId,
  parseContractId
} from '../_utils';

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const session = await requireAdminSession();
  if (!session.ok) {
    return session.response;
  }

  const { id } = await params;
  const parsedId = parseContractId(id);
  if (!parsedId) {
    return NextResponse.json({ success: false, message: '계약서 ID가 올바르지 않습니다.' }, { status: 400 });
  }

  try {
    const contract = await getContractById(parsedId);
    if (!contract) {
      return NextResponse.json({ success: false, message: '계약서를 찾을 수 없습니다.' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: '계약서 상세를 불러왔습니다.',
      contract
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '계약서 상세 조회 중 오류가 발생했습니다.';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const requestId = newContractRequestId();
  const { id } = await params;
  const parsedId = parseContractId(id);
  const httpPath = `/api/contracts/${id}`;

  const session = await requireAdminSession();
  if (!session.ok) {
    return logContractAuthFailure({
      requestId,
      action: 'contract.update',
      httpMethod: 'PATCH',
      httpPath,
      targetLabel: contractTargetLabel({ id }),
      response: session.response
    });
  }

  const actor = actorFromProfile(session.profile);

  if (!parsedId) {
    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'contract.update',
        targetType: 'contract',
        targetUserId: null,
        targetLabel: contractTargetLabel({ id }),
        httpMethod: 'PATCH',
        httpPath,
        metadata: buildErrorMetadata('validation', '계약서 ID가 올바르지 않습니다.')
      },
      { success: false, message: '계약서 ID가 올바르지 않습니다.' },
      400
    );
  }

  try {
    const body = await request.json();
    const parsed = contractUpdateSchema.safeParse(body);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? '입력값이 올바르지 않습니다.';
      return jsonWithActivityLog(
        requestId,
        {
          ...actor,
          action: 'contract.update',
          targetType: 'contract',
          targetUserId: null,
          targetLabel: contractTargetLabel({ id: parsedId }),
          httpMethod: 'PATCH',
          httpPath,
          metadata: buildErrorMetadata('validation', message)
        },
        { success: false, message },
        400
      );
    }

    if (Object.keys(parsed.data).length === 0) {
      return jsonWithActivityLog(
        requestId,
        {
          ...actor,
          action: 'contract.update',
          targetType: 'contract',
          targetUserId: null,
          targetLabel: contractTargetLabel({ id: parsedId }),
          httpMethod: 'PATCH',
          httpPath,
          metadata: buildErrorMetadata('validation', '수정할 항목이 없습니다.')
        },
        { success: false, message: '수정할 항목이 없습니다.' },
        400
      );
    }

    const updated = await updateContractDocument(parsedId, parsed.data, session.userId);
    if (!updated) {
      return jsonWithActivityLog(
        requestId,
        {
          ...actor,
          action: 'contract.update',
          targetType: 'contract',
          targetUserId: null,
          targetLabel: contractTargetLabel({ id: parsedId }),
          httpMethod: 'PATCH',
          httpPath,
          metadata: buildErrorMetadata('not_found', '계약서를 찾을 수 없습니다.')
        },
        { success: false, message: '계약서를 찾을 수 없습니다.' },
        404
      );
    }

    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'contract.update',
        targetType: 'contract',
        targetUserId: null,
        targetLabel: contractTargetLabel({
          id: updated.id,
          documentNumber: updated.document_number
        }),
        httpMethod: 'PATCH',
        httpPath,
        metadata: {
          document_number: updated.document_number,
          changed_fields: Object.keys(parsed.data),
          status: updated.status
        }
      },
      { success: true, message: '계약서가 수정되었습니다.', contract: updated },
      200
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : '계약서 수정 중 오류가 발생했습니다.';
    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'contract.update',
        targetType: 'contract',
        targetUserId: null,
        targetLabel: contractTargetLabel({ id: parsedId }),
        httpMethod: 'PATCH',
        httpPath,
        metadata: buildErrorMetadata('internal_error', message)
      },
      { success: false, message },
      500
    );
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const requestId = newContractRequestId();
  const { id } = await params;
  const parsedId = parseContractId(id);
  const httpPath = `/api/contracts/${id}`;

  const session = await requireAdminSession();
  if (!session.ok) {
    return logContractAuthFailure({
      requestId,
      action: 'contract.soft_delete',
      httpMethod: 'DELETE',
      httpPath,
      targetLabel: contractTargetLabel({ id }),
      response: session.response
    });
  }

  const actor = actorFromProfile(session.profile);

  if (!parsedId) {
    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'contract.soft_delete',
        targetType: 'contract',
        targetUserId: null,
        targetLabel: contractTargetLabel({ id }),
        httpMethod: 'DELETE',
        httpPath,
        metadata: buildErrorMetadata('validation', '계약서 ID가 올바르지 않습니다.')
      },
      { success: false, message: '계약서 ID가 올바르지 않습니다.' },
      400
    );
  }

  try {
    const deleted = await softDeleteContractDocument(parsedId, session.userId);
    if (!deleted) {
      return jsonWithActivityLog(
        requestId,
        {
          ...actor,
          action: 'contract.soft_delete',
          targetType: 'contract',
          targetUserId: null,
          targetLabel: contractTargetLabel({ id: parsedId }),
          httpMethod: 'DELETE',
          httpPath,
          metadata: buildErrorMetadata('not_found', '계약서를 찾을 수 없습니다.')
        },
        { success: false, message: '계약서를 찾을 수 없습니다.' },
        404
      );
    }

    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'contract.soft_delete',
        targetType: 'contract',
        targetUserId: null,
        targetLabel: contractTargetLabel({
          id: deleted.id,
          documentNumber: deleted.document_number
        }),
        httpMethod: 'DELETE',
        httpPath,
        metadata: {
          document_number: deleted.document_number,
          status: deleted.status
        }
      },
      { success: true, message: '계약서가 삭제 처리되었습니다.', contract: deleted },
      200
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : '계약서 삭제 처리 중 오류가 발생했습니다.';
    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'contract.soft_delete',
        targetType: 'contract',
        targetUserId: null,
        targetLabel: contractTargetLabel({ id: parsedId }),
        httpMethod: 'DELETE',
        httpPath,
        metadata: buildErrorMetadata('internal_error', message)
      },
      { success: false, message },
      500
    );
  }
}
