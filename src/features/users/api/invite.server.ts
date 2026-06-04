import 'server-only';

import { createClient as createServiceClient } from '@supabase/supabase-js';
import { generateTemporaryPassword } from '@/lib/auth/temp-password';
import { sendInviteEmail } from '@/lib/mail/send-invite-email';

function getServiceRoleClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing SUPABASE environment variables for server admin operations');
  }

  return createServiceClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

function getSignInUrl(): string {
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ?? 'http://localhost:3000';
  return `${appUrl}/auth/sign-in`;
}

function mapAuthErrorMessage(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('already') || lower.includes('registered')) {
    return '이미 등록된 이메일입니다.';
  }
  if (lower.includes('invalid') && lower.includes('email')) {
    return '올바른 이메일 주소를 입력해 주세요.';
  }
  return message;
}

export async function inviteUserWithTemporaryPassword(email: string): Promise<{
  userId: string;
}> {
  const adminClient = getServiceRoleClient();
  const temporaryPassword = generateTemporaryPassword(8);

  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password: temporaryPassword,
    email_confirm: true
  });

  if (error || !data.user) {
    throw new Error(mapAuthErrorMessage(error?.message ?? '사용자 생성에 실패했습니다.'));
  }

  const userId = data.user.id;

  const { error: profileError } = await adminClient
    .from('profiles')
    .update({
      system_role: 'user',
      password_set_at: new Date().toISOString()
    })
    .eq('user_id', userId);

  if (profileError) {
    await adminClient.auth.admin.deleteUser(userId);
    throw new Error(profileError.message);
  }

  try {
    await sendInviteEmail({
      to: email,
      temporaryPassword,
      signInUrl: getSignInUrl()
    });
  } catch (mailError) {
    await adminClient.auth.admin.deleteUser(userId);
    const message =
      mailError instanceof Error ? mailError.message : '초대 메일 발송에 실패했습니다.';
    throw new Error(message);
  }

  return { userId };
}
