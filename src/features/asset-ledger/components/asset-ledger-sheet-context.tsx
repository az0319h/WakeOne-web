'use client';

import { createContext, use, useCallback, useMemo, useState, type ReactNode } from 'react';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';

export type AssetLedgerSheetState =
  | { open: false }
  | { open: true; mode: 'create' }
  | { open: true; mode: 'edit'; id: number };

type AssetLedgerSheetContextValue = {
  state: AssetLedgerSheetState;
  openCreate: () => void;
  openEdit: (id: number) => void;
  close: () => void;
};

const AssetLedgerSheetContext = createContext<AssetLedgerSheetContextValue | null>(null);

/**
 * 추가·수정 Sheet 열림 상태 (support-sheet-context 패턴 · designer §14-19).
 * 서버 page의 `pageHeaderAction`(추가 버튼)과 Dialog 안 「수정」이 같은 Sheet를 연다.
 */
export function AssetLedgerSheetProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AssetLedgerSheetState>({ open: false });
  const openCreate = useCallback(() => setState({ open: true, mode: 'create' }), []);
  const openEdit = useCallback((id: number) => setState({ open: true, mode: 'edit', id }), []);
  const close = useCallback(() => setState({ open: false }), []);
  const value = useMemo(() => ({ state, openCreate, openEdit, close }), [state, openCreate, openEdit, close]);
  return <AssetLedgerSheetContext value={value}>{children}</AssetLedgerSheetContext>;
}

export function useAssetLedgerSheet() {
  const context = use(AssetLedgerSheetContext);
  if (!context) {
    throw new Error('useAssetLedgerSheet must be used within AssetLedgerSheetProvider');
  }
  return context;
}

type AssetLedgerCreateButtonProps = {
  label: string;
  'data-testid': string;
};

/** 페이지 머리 「구독 추가」/「비품 추가」 — 권한자에게만 서버가 렌더한다 */
export function AssetLedgerCreateButton({ label, ...rest }: AssetLedgerCreateButtonProps) {
  const { openCreate } = useAssetLedgerSheet();
  return (
    <Button type='button' data-testid={rest['data-testid']} className='h-11 md:h-9' onClick={openCreate}>
      <Icons.add aria-hidden />
      {label}
    </Button>
  );
}
