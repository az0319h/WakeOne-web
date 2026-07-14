'use client';
import { Badge } from '@/components/ui/badge';
import { DataTableColumnHeader } from '@/components/ui/table/data-table-column-header';
import type { User } from '../../api/types';
import { Column, ColumnDef } from '@tanstack/react-table';
import { Icons } from '@/components/icons';
import { formatBirthdayDisplay } from '@/lib/format';
import { formatPhoneDisplay } from '@/lib/phone';
import { UserAvatarCell } from '../user-profile-modal';
import { CellAction } from './cell-action';
import { SYSTEM_ROLE_OPTIONS } from './options';
import { getAffiliationLabel } from '../../constants/organization';

interface CreateColumnsOptions {
  onAvatarClick: (user: User) => void;
}

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
      header: '계정 상태',
      cell: ({ cell }) => {
        const status = cell.getValue<User['status']>();
        const isActive = status === 'active';
        return (
          <Badge variant={isActive ? 'outline' : 'destructive'}>
            {isActive ? '활성' : '비활성'}
          </Badge>
        );
      }
    },
    {
      id: 'actions',
      cell: ({ row }) => <CellAction data={row.original} />
    }
  ];
}
