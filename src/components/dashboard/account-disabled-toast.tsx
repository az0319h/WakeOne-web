'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { notifyError } from '@/lib/notify';

function stripAccountDisabledFromUrl() {
  const url = new URL(window.location.href);
  url.searchParams.delete('accountDisabled');
  const next = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState(window.history.state, '', next);
}

export function AccountDisabledToast() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const accountDisabled = searchParams.get('accountDisabled');
  const handledRef = useRef<string | null>(null);

  useEffect(() => {
    if (accountDisabled !== '1') {
      return;
    }

    const dedupeKey = `${pathname}:accountDisabled`;
    if (handledRef.current === dedupeKey) {
      stripAccountDisabledFromUrl();
      return;
    }
    handledRef.current = dedupeKey;

    notifyError('비활성화된 계정입니다.');
    stripAccountDisabledFromUrl();
  }, [pathname, accountDisabled]);

  return null;
}
