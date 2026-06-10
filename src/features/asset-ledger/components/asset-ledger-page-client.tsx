'use client';

import { useMemo, useState } from 'react';
import type { AssetItem } from '../api/types';
import { AssetItemsTable } from './asset-items-table';
import { AssetItemFormSheet } from './asset-item-form-sheet';

interface AssetLedgerClientPageProps {
  currentUserId?: string;
  isAdmin: boolean;
}

export function AssetLedgerClientPage({ currentUserId, isAdmin }: AssetLedgerClientPageProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<AssetItem | null>(null);

  const sheetItem = useMemo(() => editingItem, [editingItem]);

  return (
    <>
      <AssetItemsTable
        currentUserId={currentUserId}
        isAdmin={isAdmin}
        onEdit={(item) => {
          setEditingItem(item);
          setSheetOpen(true);
        }}
        onCreate={() => {
          setEditingItem(null);
          setSheetOpen(true);
        }}
      />
      <AssetItemFormSheet
        open={sheetOpen}
        onOpenChange={(open) => {
          setSheetOpen(open);
          if (!open) {
            setEditingItem(null);
          }
        }}
        item={sheetItem}
      />
    </>
  );
}
