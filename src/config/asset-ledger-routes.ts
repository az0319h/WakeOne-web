export const ASSET_LEDGER_ACCESS_DENIED_KEY = 'asset-ledger';

export function isAssetLedgerDashboardPath(pathname: string): boolean {
  return pathname === '/dashboard/product' || pathname.startsWith('/dashboard/product/');
}
