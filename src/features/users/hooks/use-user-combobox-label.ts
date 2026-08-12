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

export function useUserComboboxLabel(
  value: string,
  staticOptions: readonly StaticUserOption[],
  fallbackLabel = '선택한 사용자'
) {
  const staticOption = staticOptions.find((option) => option.value === value);
  const shouldResolveUser = isDynamicUserValue(value, staticOptions);

  const { data } = useQuery({
    ...usersQueryOptions({ userId: value, limit: 1 }),
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
