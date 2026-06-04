'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { notifyError } from '@/lib/notify';

const ACCESS_DENIED_MESSAGES: Record<string, string> = {
  users: '이 페이지에 접근할 권한이 없습니다.'
};

export function AccessDeniedToast() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const handledRef = useRef<string | null>(null);

  useEffect(() => {
    const key = searchParams.get('accessDenied');
    if (!key || !ACCESS_DENIED_MESSAGES[key]) {
      return;
    }

    const dedupeKey = `${pathname}:${key}`;
    if (handledRef.current === dedupeKey) {
      return;
    }
    handledRef.current = dedupeKey;

    notifyError(ACCESS_DENIED_MESSAGES[key]);

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete('accessDenied');
    const query = nextParams.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }, [pathname, router, searchParams]);

  return null;
}
