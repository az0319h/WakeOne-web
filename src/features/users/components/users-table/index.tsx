'use client';

import { useEffect, useMemo, useState } from 'react';
import { DataTable } from '@/components/ui/table/data-table';
import { DataTableToolbar } from '@/components/ui/table/data-table-toolbar';
import { useDataTable } from '@/hooks/use-data-table';
import { useSuspenseQuery } from '@tanstack/react-query';
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs';
import { getSortingStateParser } from '@/lib/parsers';
import { usersQueryOptions } from '../../api/queries';
import type { User } from '../../api/types';
import { UserProfileModal } from '../user-profile-modal';
import { createColumns } from './columns';

export function UsersTable() {
  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);

  const columns = useMemo(
    () =>
      createColumns({
        onAvatarClick: (user) => {
          setProfileUser(user);
          setProfileOpen(true);
        }
      }),
    []
  );

  const columnIds = columns.map((c) => c.id).filter(Boolean) as string[];

  const [params, setParams] = useQueryStates({
    page: parseAsInteger.withDefault(1),
    perPage: parseAsInteger.withDefault(10),
    name: parseAsString,
    system_role: parseAsString,
    sort: getSortingStateParser(columnIds).withDefault([])
  });

  const filters = {
    page: params.page,
    limit: params.perPage,
    ...(params.name && { search: params.name }),
    ...(params.system_role && { systemRoles: params.system_role }),
    ...(params.sort.length > 0 && { sort: JSON.stringify(params.sort) })
  };

  const { data } = useSuspenseQuery(usersQueryOptions(filters));

  const profileUserId = profileUser?.id;

  useEffect(() => {
    if (!profileUserId) return;
    const updated = data.users.find((user) => user.id === profileUserId);
    if (updated) {
      setProfileUser(updated);
    }
  }, [data.users, profileUserId]);

  const pageCount = Math.max(1, Math.ceil(data.total_users / params.perPage) || 1);

  useEffect(() => {
    if (params.page > pageCount) {
      void setParams({ page: pageCount });
    }
  }, [params.page, pageCount, setParams]);

  const { table } = useDataTable({
    data: data.users,
    columns,
    pageCount,
    shallow: true,
    debounceMs: 500,
    initialState: {
      columnPinning: { right: ['actions'] }
    }
  });

  return (
    <>
      <div className='flex flex-1 flex-col'>
        <DataTable table={table}>
          <DataTableToolbar table={table} />
        </DataTable>
      </div>
      <UserProfileModal
        user={profileUser}
        open={profileOpen}
        onOpenChange={setProfileOpen}
      />
    </>
  );
}
