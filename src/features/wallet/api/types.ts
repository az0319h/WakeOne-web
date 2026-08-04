export type WalletSyncItemStatus = 'matched' | 'unmatched';

export interface WalletSyncItemInput {
  name: string;
  monthly_limit: number;
  monthly_remaining: number;
}

export interface WalletSyncPayload {
  synced_at: string;
  items: WalletSyncItemInput[];
}

export interface WalletSyncItemResult {
  name: string;
  status: WalletSyncItemStatus;
  user_id: string | null;
  monthly_limit: number;
  monthly_remaining: number;
  previous_remaining: number | null;
}

export interface WalletSyncResult {
  synced_at: string;
  matched: number;
  unmatched: string[];
  results: WalletSyncItemResult[];
}

/** 한도 스냅샷(Hero) — 사용자별 최신 wallet_syncs 1행 파생. */
export interface WalletLimitSnapshot {
  monthly_limit: number;
  monthly_remaining: number;
  matched_name: string;
  source: string;
  synced_at: string;
}

/** 동기화 기록(타임라인) 한 건. */
export interface WalletSyncLogEntry {
  id: number;
  monthly_limit: number;
  monthly_remaining: number;
  previous_remaining: number | null;
  status: WalletSyncItemStatus;
  source: string;
  synced_at: string;
}

/** 지갑 페이지 Read 필터 (admin 사용자 전환용). */
export interface WalletSummaryFilters {
  /** 'self' | userId. 비-admin 은 항상 self 로 강제. */
  user?: string;
}

/** Hero 스냅샷 응답 (사용자별 최신 1행 파생). */
export interface WalletSummary {
  snapshot: WalletLimitSnapshot | null;
  viewer: {
    userId: string;
    isAdmin: boolean;
    targetUserId: string;
  };
}

/** 동기화 기록 무한 스크롤 필터 (cursor 기반). */
export interface WalletSyncsFilters {
  /** 'self' | userId. 비-admin 은 항상 self 로 강제. */
  user?: string;
  cursor?: string;
  limit?: number;
}

/** 동기화 기록 한 페이지 응답. */
export interface WalletSyncsListResponse {
  syncs: WalletSyncLogEntry[];
  nextCursor: string | null;
  hasMore: boolean;
}
