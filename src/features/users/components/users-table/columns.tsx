'use client';
import { Badge } from '@/components/ui/badge';
import { DataTableColumnHeader } from '@/components/ui/table/data-table-column-header';
import type { User } from '../../api/types';
import { Column, ColumnDef } from '@tanstack/react-table';
import { Icons } from '@/components/icons';
import { CellAction } from './cell-action';
import {
  DEPARTMENT_OPTIONS_BY_ORG,
  ORG_ROLE_OPTIONS,
  ORGANIZATION_OPTIONS,
  SYSTEM_ROLE_OPTIONS
} from './options';

const DEPARTMENT_OPTIONS = Object.values(DEPARTMENT_OPTIONS_BY_ORG).flatMap((options) => options);

export const columns: ColumnDef<User>[] = [
  {
    id: 'name',
    accessorFn: (row) => `${row.first_name} ${row.last_name}`,
    header: ({ column }: { column: Column<User, unknown> }) => (
      <DataTableColumnHeader column={column} title='Name' />
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
      label: 'Name',
      placeholder: 'Search users...',
      variant: 'text' as const,
      icon: Icons.text
    },
    enableColumnFilter: true
  },
  {
    accessorKey: 'phone',
    header: 'PHONE'
  },
  {
    id: 'system_role',
    accessorKey: 'system_role',
    enableSorting: false,
    header: ({ column }: { column: Column<User, unknown> }) => (
      <DataTableColumnHeader column={column} title='System Role' />
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
      label: 'system role',
      variant: 'multiSelect' as const,
      options: SYSTEM_ROLE_OPTIONS
    }
  },
  {
    id: 'organization',
    accessorKey: 'organization',
    enableSorting: false,
    header: ({ column }: { column: Column<User, unknown> }) => (
      <DataTableColumnHeader column={column} title='Organization' />
    ),
    cell: ({ cell }) => (
      <Badge variant='secondary' className='uppercase'>
        {cell.getValue<User['organization']>()}
      </Badge>
    ),
    enableColumnFilter: true,
    meta: {
      label: 'organization',
      variant: 'multiSelect' as const,
      options: ORGANIZATION_OPTIONS
    }
  },
  {
    id: 'department',
    accessorKey: 'department',
    enableSorting: false,
    header: ({ column }: { column: Column<User, unknown> }) => (
      <DataTableColumnHeader column={column} title='Department' />
    ),
    cell: ({ cell }) => (
      <Badge variant='outline' className='capitalize'>
        {cell.getValue<User['department']>()}
      </Badge>
    ),
    enableColumnFilter: true,
    meta: {
      label: 'department',
      variant: 'multiSelect' as const,
      options: DEPARTMENT_OPTIONS
    }
  },
  {
    id: 'org_role',
    accessorKey: 'org_role',
    enableSorting: false,
    header: ({ column }: { column: Column<User, unknown> }) => (
      <DataTableColumnHeader column={column} title='Org Role' />
    ),
    cell: ({ cell }) => {
      return (
        <Badge variant='outline' className='capitalize'>
          {cell.getValue<User['org_role']>()}
        </Badge>
      );
    },
    enableColumnFilter: true,
    meta: {
      label: 'org role',
      variant: 'multiSelect' as const,
      options: ORG_ROLE_OPTIONS
    }
  },
  {
    accessorKey: 'invite_status',
    header: 'INVITE STATUS',
    cell: ({ cell }) => {
      const inviteStatus = cell.getValue<User['invite_status']>();
      const variant =
        inviteStatus === 'accepted'
          ? 'default'
          : inviteStatus === 'pending'
            ? 'secondary'
            : 'outline';
      return <Badge variant={variant}>{inviteStatus}</Badge>;
    }
  },
  {
    id: 'actions',
    cell: ({ row }) => <CellAction data={row.original} />
  }
];
