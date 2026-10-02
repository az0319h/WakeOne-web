'use client';

import { Suspense, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { AUTH_ERROR_MESSAGES as AuthMessages } from '@/features/auth/api/types';
import {
  clearAccountDisabledFlash,
  readAccountDisabledFlash
} from '@/lib/auth/account-disabled-flash';
import {
  clearSupabaseOAuthHash,
  isUserBannedOAuthSignal,
  readSupabaseOAuthHashErrorCode,
  readSupabaseOAuthHashErrorDescription
} from '@/lib/auth/supabase-oauth-error';
import { notifyError, notifyInfo } from '@/lib/notify';
import { sanitizeRedirectTo } from '@/lib/auth/safe-redirect';

const AUTH_STATUS_MESSAGES = {
  pending_approval: '관리자 승인 대기 중입니다. 승인 완료 후 로그인할 수 있습니다.',
  rejected: '가입 요청이 거절되었습니다. 관리자에게 문의해 주세요.'
} as const;

const AUTH_ERROR_MESSAGES = {
  google_oauth_start_failed: 'Google 로그인을 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.',
  google_oauth_callback_failed: 'Google 로그인 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'
} as const;

function shouldShowAccountDisabledToast(searchParams: {
  get: (key: string) => string | null;
}): boolean {
  if (searchParams.get('accountDisabled') === '1') {
    return true;
  }

  if (typeof window === 'undefined') {
    return false;
  }

  if (readAccountDisabledFlash()) {
    return true;
  }

  const hashErrorCode = readSupabaseOAuthHashErrorCode();
  const hashErrorDescription = readSupabaseOAuthHashErrorDescription();
  return isUserBannedOAuthSignal(hashErrorCode, hashErrorDescription);
}

function UserAuthFormFields() {
  const searchParams = useSearchParams();

  const redirectTo = sanitizeRedirectTo(
    searchParams.get('redirectTo'),
    '/dashboard/overview'
  );
  const googleStartHref = `/api/auth/google/start?redirectTo=${encodeURIComponent(redirectTo)}`;

  useEffect(() => {
    const authStatus = searchParams.get('authStatus');
    if (
      authStatus === 'pending_approval' ||
      authStatus === 'rejected'
    ) {
      notifyInfo(AUTH_STATUS_MESSAGES[authStatus]);
    }

    if (shouldShowAccountDisabledToast(searchParams)) {
      notifyError(AuthMessages.ACCOUNT_DISABLED);
      clearAccountDisabledFlash();
      clearSupabaseOAuthHash();
      return;
    }

    const authError = searchParams.get('authError');
    if (
      authError === 'google_oauth_start_failed' ||
      authError === 'google_oauth_callback_failed'
    ) {
      notifyError(AUTH_ERROR_MESSAGES[authError]);
    }
  }, [searchParams]);

  return (
    <div className='w-full space-y-4'>
      <Button asChild className='w-full' size='lg'>
        <a href={googleStartHref}>
          <Icons.login className='h-4 w-4' />
          Google로 로그인
        </a>
      </Button>
      <p className='text-muted-foreground text-center text-xs'>
        승인된 계정만 대시보드에 접근할 수 있습니다.
      </p>
    </div>
  );
}

export default function UserAuthForm() {
  return (
    <Suspense fallback={<div className='text-muted-foreground text-sm'>로딩 중…</div>}>
      <UserAuthFormFields />
    </Suspense>
  );
}
