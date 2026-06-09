'use client';

import { useEffect, useRef } from 'react';
import { OFFICE_SNACKS_ACCESS_DENIED_MESSAGE } from '@/features/office-snacks/api/access';
import { OFFICE_SNACKS_ACCESS_DENIED_KEY } from '@/config/office-snacks-routes';
import {
  clearAccessDeniedFlash,
  readAccessDeniedFlash
} from '@/lib/auth/access-denied-flash';
import { notifyError } from '@/lib/notify';

const ACCESS_DENIED_MESSAGES: Record<string, string> = {
  users: '이 페이지에 접근할 권한이 없습니다.',
  [OFFICE_SNACKS_ACCESS_DENIED_KEY]: OFFICE_SNACKS_ACCESS_DENIED_MESSAGE
};

function readLegacyAccessDeniedParam(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get('accessDenied');
}

function stripLegacyAccessDeniedParam() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has('accessDenied')) {
    return;
  }
  url.searchParams.delete('accessDenied');
  const next = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState(window.history.state, '', next);
}

export function AccessDeniedToast() {
  const handledRef = useRef(false);

  useEffect(() => {
    if (handledRef.current) {
      return;
    }

    let key = readAccessDeniedFlash();
    if (key) {
      clearAccessDeniedFlash();
    } else {
      key = readLegacyAccessDeniedParam();
      if (key) {
        stripLegacyAccessDeniedParam();
      }
    }

    if (!key || !ACCESS_DENIED_MESSAGES[key]) {
      return;
    }

    handledRef.current = true;
    notifyError(ACCESS_DENIED_MESSAGES[key]);
  }, []);

  return null;
}
