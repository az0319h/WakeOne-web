import 'server-only';

import { getServiceRoleClient } from '@/lib/supabase/service-role';
import type { QuickRequestLocation, QuickRequestNote, QuickRequestRecentAddress } from './types';
import { QUICK_REQUEST_RECENT_ADDRESSES_MAX_COUNT } from '../schemas/quick-request-recent-address';

/**
 * plan 87 — 퀵 요청 특이사항 칩 · 최근 주소 서버 데이터 접근.
 * 모든 쿼리는 service role + `user_id = userId` 조건을 강제한다 (Route · 서버 prefetch 공용).
 */

const NOTES_TABLE = 'quick_request_notes';
const RECENT_TABLE = 'quick_request_recent_addresses';
const NOTES_LIMIT_ERROR_MESSAGE = 'quick_request_notes_limit_exceeded';
const UNIQUE_VIOLATION = '23505';

type DbError = { code?: string; message: string } | null;

type NoteRow = { id: number; label: string };

type RecentAddressRow = {
  road_address: string;
  detail_address: string;
  contact_name: string;
  contact_phone: string;
  last_used_at: string;
};

export type QuickRequestNoteConflict = 'duplicate' | 'limit_exceeded';

export type CreateQuickRequestNoteResult =
  | { ok: true; note: QuickRequestNote }
  | { ok: false; reason: QuickRequestNoteConflict };

export type UpdateQuickRequestNoteResult =
  | { ok: true; note: QuickRequestNote; previousLabel: string }
  | { ok: false; reason: 'not_found' | 'duplicate' };

export type DeleteQuickRequestNoteResult =
  | { ok: true; id: number; label: string }
  | { ok: false; reason: 'not_found' };

function toNote(row: NoteRow): QuickRequestNote {
  return { id: Number(row.id), label: row.label };
}

function classifyNoteWriteError(error: DbError): QuickRequestNoteConflict | null {
  if (!error) return null;
  if (error.code === UNIQUE_VIOLATION) return 'duplicate';
  if (error.message?.includes(NOTES_LIMIT_ERROR_MESSAGE)) return 'limit_exceeded';
  return null;
}

export async function listQuickRequestNotes(userId: string): Promise<QuickRequestNote[]> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from(NOTES_TABLE)
    .select('id, label')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as NoteRow[]).map(toNote);
}

export async function getQuickRequestNote(
  userId: string,
  id: number
): Promise<QuickRequestNote | null> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from(NOTES_TABLE)
    .select('id, label')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ? toNote(data as NoteRow) : null;
}

/** `label`은 trim 완료 값. 10개 상한은 DB trigger가 강제한다 */
export async function createQuickRequestNote(
  userId: string,
  label: string
): Promise<CreateQuickRequestNoteResult> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from(NOTES_TABLE)
    .insert({ user_id: userId, label })
    .select('id, label')
    .single();

  const conflict = classifyNoteWriteError(error);
  if (conflict) {
    return { ok: false, reason: conflict };
  }
  if (error || !data) {
    throw new Error(error?.message ?? 'quick_request_notes insert returned no row');
  }

  return { ok: true, note: toNote(data as NoteRow) };
}

export async function updateQuickRequestNote(
  userId: string,
  id: number,
  label: string
): Promise<UpdateQuickRequestNoteResult> {
  const existing = await getQuickRequestNote(userId, id);
  if (!existing) {
    return { ok: false, reason: 'not_found' };
  }

  if (existing.label === label) {
    return { ok: true, note: existing, previousLabel: existing.label };
  }

  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from(NOTES_TABLE)
    .update({ label })
    .eq('id', id)
    .eq('user_id', userId)
    .select('id, label')
    .maybeSingle();

  if (classifyNoteWriteError(error) === 'duplicate') {
    return { ok: false, reason: 'duplicate' };
  }
  if (error) {
    throw new Error(error.message);
  }
  if (!data) {
    return { ok: false, reason: 'not_found' };
  }

  return { ok: true, note: toNote(data as NoteRow), previousLabel: existing.label };
}

export async function deleteQuickRequestNote(
  userId: string,
  id: number
): Promise<DeleteQuickRequestNoteResult> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from(NOTES_TABLE)
    .delete()
    .eq('id', id)
    .eq('user_id', userId)
    .select('id, label')
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!data) {
    return { ok: false, reason: 'not_found' };
  }

  const row = data as NoteRow;
  return { ok: true, id: Number(row.id), label: row.label };
}

export async function listQuickRequestRecentAddresses(
  userId: string
): Promise<QuickRequestRecentAddress[]> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from(RECENT_TABLE)
    .select('road_address, detail_address, contact_name, contact_phone, last_used_at')
    .eq('user_id', userId)
    .order('last_used_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(QUICK_REQUEST_RECENT_ADDRESSES_MAX_COUNT);

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as RecentAddressRow[]).map((row) => ({
    roadAddress: row.road_address,
    detailAddress: row.detail_address,
    contactName: row.contact_name,
    contactPhone: row.contact_phone,
    lastUsedAt: row.last_used_at
  }));
}

/**
 * upsert(도로명+상세 dedupe) + 사용자별 10개 prune — RPC 한 트랜잭션 (service_role 전용).
 * `locations` 앞쪽 항목이 더 최근으로 기록된다. 반환값은 upsert된 고유 주소 수.
 */
export async function recordQuickRequestRecentAddresses(
  userId: string,
  locations: QuickRequestLocation[]
): Promise<number> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase.rpc('record_quick_request_recent_addresses', {
    p_user_id: userId,
    p_items: locations.map((location) => ({
      roadAddress: location.roadAddress,
      detailAddress: location.detailAddress,
      contactName: location.contactName,
      contactPhone: location.contactPhone
    }))
  });

  if (error) {
    throw new Error(error.message);
  }

  return typeof data === 'number' ? data : Number(data ?? 0);
}
