import { createClient } from '@supabase/supabase-js';

/** plan 87 e2e — service role 직접 조회 (AC-14 ② seed 확인 등 · 쓰기는 하지 않는다) */
export function quickRequestServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  }
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

export async function selectNoteLabelsForUser(userId: string): Promise<string[]> {
  const { data, error } = await quickRequestServiceClient()
    .from('quick_request_notes')
    .select('label')
    .eq('user_id', userId);
  if (error) {
    throw new Error(`quick_request_notes select failed: ${error.message}`);
  }
  return (data ?? []).map(({ label }) => label as string);
}
