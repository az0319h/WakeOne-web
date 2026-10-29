'use client';

import { AssetLedgerDialogFrame } from '@/features/asset-ledger/components/asset-ledger-dialog-frame';
import { useLedgerDialogParams } from '@/features/asset-ledger/hooks/use-ledger-params';
import type { AssetTargetType } from '../api/types';
import { AssetRequestDetail } from './asset-request-detail';

type AssetDetailDialogProps = {
  targetType: AssetTargetType;
  'data-testid': string;
  /** 화면 1 — 행 화면 (구독·비품 feature가 그린다) */
  renderRow: (rowId: number) => React.ReactNode;
  /** 화면 2 — 요청 폼 (대상 이름이 필요해 feature가 그린다) */
  renderCompose: (rowId: number) => React.ReactNode;
};

/**
 * plan 103 · designer §2-5 — 가운데 Dialog 하나에 화면 3개를 URL로 전환.
 * `?equipment={id}` 행 · `&compose=1` 요청 폼 · `&request={rid}` 요청 1건. 새로고침·알림 클릭으로 바로 열린다(AC-42).
 */
export function AssetDetailDialog({
  targetType,
  renderRow,
  renderCompose,
  ...rest
}: AssetDetailDialogProps) {
  const { rowId, requestId, screen, close, backToRow, openTargetRow } = useLedgerDialogParams(targetType);

  return (
    <AssetLedgerDialogFrame
      open={screen !== null}
      onOpenChange={(next) => {
        if (!next) close();
      }}
      data-testid={rest['data-testid']}
    >
      {screen === 'row' && rowId !== null ? renderRow(rowId) : null}
      {screen === 'compose' && rowId !== null ? renderCompose(rowId) : null}
      {screen === 'request' && requestId !== null ? (
        <AssetRequestDetail
          key={requestId}
          targetType={targetType}
          requestId={requestId}
          openedFromRow={rowId !== null}
          onBack={backToRow}
          onOpenTarget={openTargetRow}
          onClose={close}
        />
      ) : null}
    </AssetLedgerDialogFrame>
  );
}
