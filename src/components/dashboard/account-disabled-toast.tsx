'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { notifyError } from '@/lib/notify';

export function AccountDisabledToast() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const handledRef = useRef<string | null>(null);

  useEffect(() => {
    if (searchParams.get('accountDisabled') !== '1') {
      return;
    }

    const dedupeKey = `${pathname}:accountDisabled`;
    if (handledRef.current === dedupeKey) {
      return;
    }
    handledRef.current = dedupeKey;

    notifyError('비활성화된 계정입니다.');

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete('accountDisabled');
    const query = nextParams.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }, [pathname, router, searchParams]);

  return null;
}
