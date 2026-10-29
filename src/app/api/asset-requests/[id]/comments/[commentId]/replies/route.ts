import type { NextRequest } from 'next/server';
import { handleCreateAssetComment } from '../../_shared';

type Params = { params: Promise<{ id: string; commentId: string }> };

/** plan 103 — 답글 작성 (임의 깊이 · 삭제된 댓글에는 400) */
export async function POST(request: NextRequest, { params }: Params) {
  const { id, commentId } = await params;
  return handleCreateAssetComment({ request, rawId: id, rawParentId: commentId });
}
