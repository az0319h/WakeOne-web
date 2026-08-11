'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { DataTable } from '@/components/ui/table/data-table';
import { DataTableToolbar } from '@/components/ui/table/data-table-toolbar';
import { PageLoadingSpinner } from '@/components/ui/page-loading-spinner';
import { useDataTable } from '@/hooks/use-data-table';
import { useSuspenseQuery } from '@tanstack/react-query';
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs';
import { getSortingStateParser } from '@/lib/parsers';
import { usersQueryOptions } from '../../api/queries';
import type { User } from '../../api/types';
import { UserProfileModal } from '../user-profile-modal';
import { createColumns } from './columns';

interface UsersTableBodyProps {
  columns: ReturnType<typeof createColumns>;
  filters: {
    page: number;
    limit: number;
    search?: string;
    systemRoles?: string;
    sort?: string;
  };
  profileUserId: string | undefined;
  onProfileUserSync: (user: User) => void;
}

function UsersTableBody({
  columns,
  filters,
  profileUserId,
  onProfileUserSync
}: UsersTableBodyProps) {
  const [, setParams] = useQueryStates({
    page: parseAsInteger.withDefault(1)
  });

  const { data } = useSuspenseQuery(usersQueryOptions(filters));

  const pageCount = Math.max(1, Math.ceil(data.total_users / filters.limit) || 1);

  useEffect(() => {
    if (filters.page > pageCount) {
      void setParams({ page: pageCount });
    }
  }, [filters.page, pageCount, setParams]);

  useEffect(() => {
    if (!profileUserId) {
      return;
    }
    const updated = data.users.find((user) => user.id === profileUserId);
    if (updated) {
      onProfileUserSync(updated);
    }
  }, [data.users, onProfileUserSync, profileUserId]);

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

  return <DataTable table={table} />;
}

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

  const columnIds = columns.map((column) => column.id).filter(Boolean) as string[];

  const [params] = useQueryStates({
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

  const querySignature = JSON.stringify(filters);

  const { table: shellTable } = useDataTable({
    data: [],
    columns,
    pageCount: 1,
    shallow: true,
    debounceMs: 500,
    initialState: {
      columnPinning: { right: ['actions'] }
    }
  });

  return (
    <>
      <div className='flex min-w-0 flex-1 flex-col'>
        <DataTableToolbar table={shellTable} />
        <Suspense key={querySignature} fallback={<PageLoadingSpinner variant='fill' />}>
          <UsersTableBody
            columns={columns}
            filters={filters}
            profileUserId={profileUser?.id}
            onProfileUserSync={setProfileUser}
          />
        </Suspense>
      </div>
      <UserProfileModal
        user={profileUser}
        open={profileOpen}
        onOpenChange={setProfileOpen}
      />
    </>
  );
}
