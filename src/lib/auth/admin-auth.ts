import 'server-only';

export async function adminSignOutGlobal(userId: string): Promise<void> {
  const { getServiceRoleClient } = await import('@/lib/supabase/service-role');
  const admin = getServiceRoleClient();
  const { error } = await admin.rpc('revoke_user_sessions', {
    target_user_id: userId
  });

  if (error) {
    throw new Error(error.message || '세션 종료에 실패했습니다.');
  }
}

export async function adminBanUser(userId: string): Promise<void> {
  const { getServiceRoleClient } = await import('@/lib/supabase/service-role');
  const admin = getServiceRoleClient();
  const { error } = await admin.auth.admin.updateUserById(userId, {
    ban_duration: '876000h'
  });

  if (error) {
    throw new Error(error.message);
  }
}
