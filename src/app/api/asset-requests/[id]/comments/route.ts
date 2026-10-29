import type { NextRequest } from 'next/server';
import {
  getVisibleAssetRequestRow,
  listAssetRequestComments
} from '@/features/asset-requests/api/service.server';
import { ASSET_REQUEST_MESSAGES } from '@/features/asset-requests/api/types';
import {
  assetJson,
  assetReadError,
  parsePositiveId,
  requireAssetSession
} from '../../../asset-ledger/_utils';
import { handleCreateAssetComment } from './_shared';

type Params = { params: Promise<{ id: string }> };

/** plan 103 — 댓글 목록 (요청자·권한자 · 그 외 404) · `path` 정렬 flat tree */
export async function GET(_request: NextRequest, { params }: Params) {
  const session = await requireAssetSession();
  if (!session.ok) return session.response;

  const id = parsePositiveId((await params).id);
  if (!id) return assetReadError(404, ASSET_REQUEST_MESSAGES.notFound);

  try {
    const row = await getVisibleAssetRequestRow(id, session.viewer);
    if (!row) return assetReadError(404, ASSET_REQUEST_MESSAGES.notFound);
    return assetJson({ comments: await listAssetRequestComments(row) });
  } catch (error) {
    console.error('[asset-requests] comments failed:', error instanceof Error ? error.message : error);
    return assetReadError(500, '댓글을 불러오지 못했습니다.');
  }
}

/** plan 103 — 원댓글 작성 */
export async function POST(request: NextRequest, { params }: Params) {
  return handleCreateAssetComment({ request, rawId: (await params).id, rawParentId: null });
}
