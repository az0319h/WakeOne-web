'use client';
import { Badge } from '@/components/ui/badge';
import { DataTableColumnHeader } from '@/components/ui/table/data-table-column-header';
import type { User } from '../../api/types';
import { Column, ColumnDef } from '@tanstack/react-table';
import { Icons } from '@/components/icons';
import { CellAction } from './cell-action';
import { SYSTEM_ROLE_OPTIONS } from './options';

export const columns: ColumnDef<User>[] = [
  {
    id: 'name',
    accessorFn: (row) => `${row.first_name} ${row.last_name}`,
    header: ({ column }: { column: Column<User, unknown> }) => (
      <DataTableColumnHeader column={column} title='이름' />
    ),
    cell: ({ row }) => (
      <div className='flex flex-col'>
        <span className='font-medium'>
          {row.original.first_name} {row.original.last_name}
        </span>
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
    cell: ({ cell }) => cell.getValue<string | null>() ?? '—'
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
    id: 'invite_status',
    accessorKey: 'invite_status',
    header: '초대 상태',
    cell: ({ cell }) => {
      const inviteStatus = cell.getValue<User['invite_status']>();
      const variant = inviteStatus === 'accepted' ? 'default' : 'secondary';
      const label = inviteStatus === 'accepted' ? '수락' : '대기';
      return <Badge variant={variant}>{label}</Badge>;
    }
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
