'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { usersQueryOptions } from '@/features/users/api/queries';

type StaticUserOption = {
  value: string;
  label: string;
};

function isDynamicUserValue(value: string, staticOptions: readonly StaticUserOption[]) {
  return !staticOptions.some((option) => option.value === value);
}

type UseUserComboboxLabelOptions = {
  /** plan 95 — 동방특송 포함 조회. 활동 로그·알림 「타인 보기」 콤보만 true (기본 false = 서버 제외) */
  includeDongbang?: boolean;
  fallbackLabel?: string;
};

export function useUserComboboxLabel(
  value: string,
  staticOptions: readonly StaticUserOption[],
  options: UseUserComboboxLabelOptions = {}
) {
  const { includeDongbang = false, fallbackLabel = '선택한 사용자' } = options;
  const staticOption = staticOptions.find((option) => option.value === value);
  const shouldResolveUser = isDynamicUserValue(value, staticOptions);

  const { data } = useQuery({
    ...usersQueryOptions({
      userId: value,
      limit: 1,
      ...(includeDongbang && { includeDongbang: true })
    }),
    enabled: shouldResolveUser
  });

  return useMemo(() => {
    if (staticOption) {
      return staticOption.label;
    }

    if (!shouldResolveUser) {
      return staticOptions[0]?.label ?? fallbackLabel;
    }

    const user = data?.users.find((item) => item.id === value);
    return user?.full_name ?? fallbackLabel;
  }, [data?.users, fallbackLabel, shouldResolveUser, staticOption, staticOptions, value]);
}
