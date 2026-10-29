'use client';

import { useEffect, useState } from 'react';

/** 값이 `ms` 동안 바뀌지 않으면 반영 (plan 101 후보 검색 300ms · 프로젝트 공용 debounce 훅 없음) */
export function useDebouncedValue<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);

  return debounced;
}
