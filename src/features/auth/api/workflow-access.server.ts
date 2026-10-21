import 'server-only';

import { getServiceRoleClient } from '@/lib/supabase/service-role';
import type { AuthProfile } from './types';

export const WORKFLOW_ADMIN_REQUIRED_MESSAGE = '워크플로우 관리자 권한이 필요합니다.';

/**
 * 워크플로우 관리자 = 시스템 관리자 OR workflow_admins 행 (plan 88 · PERMISSIONS §1).
 * DB 판정 함수 private.is_workflow_admin과 같은 규칙.
 */
export async function isWorkflowAdmin(
  profile: Pick<AuthProfile, 'user_id' | 'system_role' | 'status'>
): Promise<boolean> {
  if (profile.status !== 'active') return false;
  if (profile.system_role === 'admin') return true;

  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from('workflow_admins')
    .select('user_id')
    .eq('user_id', profile.user_id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return Boolean(data);
}
