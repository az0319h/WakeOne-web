'use client';
import { Badge } from '@/components/ui/badge';
import { DataTableColumnHeader } from '@/components/ui/table/data-table-column-header';
import type { User } from '../../api/types';
import { Column, ColumnDef } from '@tanstack/react-table';
import { Icons } from '@/components/icons';
import { formatBirthdayDisplay } from '@/lib/format-date';
import { formatPhoneDisplay } from '@/lib/phone';
import { UserAvatarCell } from '../user-profile-modal';
import { CellAction } from './cell-action';
import { PROFILE_STATUS_OPTIONS, SYSTEM_ROLE_OPTIONS } from './options';
import { getAffiliationLabel } from '../../constants/organization';

interface CreateColumnsOptions {
  onAvatarClick: (user: User) => void;
}

const STATUS_BADGE_CONFIG: Record<
  User['status'],
  { label: string; variant: 'outline' | 'secondary' | 'destructive' }
> = {
  active: { label: '활성', variant: 'outline' },
  inactive: { label: '비활성', variant: 'destructive' },
  pending_approval: { label: '승인 대기', variant: 'secondary' },
  rejected: { label: '거절됨', variant: 'destructive' }
};

export function createColumns({ onAvatarClick }: CreateColumnsOptions): ColumnDef<User>[] {
  return [
    {
      id: 'avatar',
      accessorKey: 'avatar_url',
      header: '아바타',
      enableSorting: false,
      enableColumnFilter: false,
      cell: ({ row }) => (
        <UserAvatarCell user={row.original} onClick={onAvatarClick} />
      )
    },
    {
      id: 'name',
      accessorFn: (row) => row.full_name,
      header: ({ column }: { column: Column<User, unknown> }) => (
        <DataTableColumnHeader column={column} title='이름' />
      ),
      cell: ({ row }) => (
        <div className='flex flex-col'>
          <span className='font-medium'>{row.original.full_name}</span>
          <span className='text-muted-foreground text-xs'>{row.original.email}</span>
        </div>
      ),
      meta: {
        label: '이름',
        placeholder: '사용자 검색…',
        variant: 'text' as const,
        icon: Icons.text
      },
      enableColumnFilter: true
    },
    {
      accessorKey: 'phone',
      header: '연락처',
      cell: ({ row }) => formatPhoneDisplay(row.original.phone) ?? '—'
    },
    {
      accessorKey: 'birthday',
      header: '생일',
      enableSorting: false,
      enableColumnFilter: false,
      cell: ({ row }) => formatBirthdayDisplay(row.original.birthday) ?? '—'
    },
    {
      id: 'system_role',
      accessorKey: 'system_role',
      enableSorting: false,
      header: ({ column }: { column: Column<User, unknown> }) => (
        <DataTableColumnHeader column={column} title='시스템 역할' />
      ),
      cell: ({ cell }) => {
        return (
          <Badge variant='outline' className='capitalize'>
            {cell.getValue<User['system_role']>()}
          </Badge>
        );
      },
      enableColumnFilter: true,
      meta: {
        label: '시스템 역할',
        variant: 'multiSelect' as const,
        options: SYSTEM_ROLE_OPTIONS
      }
    },
    {
      id: 'affiliation',
      accessorKey: 'affiliation',
      header: ({ column }: { column: Column<User, unknown> }) => (
        <DataTableColumnHeader column={column} title='소속' />
      ),
      cell: ({ cell }) => {
        return getAffiliationLabel(cell.getValue<User['affiliation']>()) ?? '—';
      }
    },
    {
      id: 'rank',
      accessorKey: 'rank',
      header: ({ column }: { column: Column<User, unknown> }) => (
        <DataTableColumnHeader column={column} title='부서/사업장' />
      ),
      cell: ({ cell }) => cell.getValue<string | null>() ?? '—'
    },
    {
      id: 'status',
      accessorKey: 'status',
      header: ({ column }: { column: Column<User, unknown> }) => (
        <DataTableColumnHeader column={column} title='계정 상태' />
      ),
      cell: ({ cell }) => {
        const status = cell.getValue<User['status']>();
        const config = STATUS_BADGE_CONFIG[status];
        return (
          <Badge variant={config.variant}>
            {config.label}
          </Badge>
        );
      },
      enableColumnFilter: true,
      meta: {
        label: '계정 상태',
        variant: 'multiSelect' as const,
        options: PROFILE_STATUS_OPTIONS
      }
    },
    {
      id: 'actions',
      cell: ({ row }) => <CellAction data={row.original} />
    }
  ];
}
