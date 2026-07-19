'use client';

import { useState } from 'react';
import { Icons } from '@/components/icons';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar
} from '@/components/ui/sidebar';
import Link from 'next/link';
import { signOut } from '@/features/auth/api/service';
import { ProfilePasswordSheet } from '@/features/auth/components/profile-password-sheet';
import type { AuthProfile } from '@/features/auth/api/types';
import { getProfileDisplayName } from '@/features/auth/lib/display-name';

interface NavUserProps {
  profile: AuthProfile;
}

function NavUserAvatar({
  profile,
  displayName,
  initials
}: {
  profile: AuthProfile;
  displayName: string;
  initials: string;
}) {
  const [imageError, setImageError] = useState(false);
  const showImage = Boolean(profile.avatar_url) && !imageError;

  return (
    <Avatar key={profile.avatar_url ?? 'no-avatar'} className='h-8 w-8 rounded-lg'>
      {showImage ? (
        <AvatarImage
          src={profile.avatar_url!}
          alt={displayName}
          onError={() => setImageError(true)}
        />
      ) : null}
      <AvatarFallback className='rounded-lg'>{initials}</AvatarFallback>
    </Avatar>
  );
}

export function NavUser({ profile }: NavUserProps) {
  const { isMobile } = useSidebar();
  const [passwordOpen, setPasswordOpen] = useState(false);
  const displayName = getProfileDisplayName(profile);
  const initials = displayName.slice(0, 2).toUpperCase();

  async function handleSignOut() {
    await signOut();
    window.location.assign('/auth/sign-in');
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size='lg'
              className='data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground'
            >
              <NavUserAvatar profile={profile} displayName={displayName} initials={initials} />
              <div className='grid flex-1 text-left text-sm leading-tight'>
                <span className='truncate font-semibold' data-testid='nav-user-display-name'>
                  {displayName}
                </span>
                <span className='truncate text-xs'>{profile.email}</span>
              </div>
              <Icons.chevronsDown className='ml-auto size-4' />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className='w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg'
            side={isMobile ? 'bottom' : 'right'}
            align='end'
            sideOffset={4}
          >
            <DropdownMenuLabel className='p-0 font-normal'>
              <div className='flex items-center gap-2 px-1 py-1.5 text-left text-sm'>
                <NavUserAvatar profile={profile} displayName={displayName} initials={initials} />
                <div className='grid flex-1 text-left text-sm leading-tight'>
                  <span className='truncate font-semibold'>{displayName}</span>
                  <span className='truncate text-xs'>{profile.email}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href='/dashboard/profile'>
                <Icons.user className='mr-2 h-4 w-4' />
                프로필
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href='/dashboard/notifications'>
                <Icons.notification className='mr-2 h-4 w-4' />
                알림
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={(event) => {
                event.preventDefault();
                setPasswordOpen(true);
              }}
            >
              <Icons.lock className='mr-2 h-4 w-4' />
              비밀번호 변경
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => void handleSignOut()}>
              <Icons.logout className='mr-2 h-4 w-4' />
              로그아웃
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <ProfilePasswordSheet open={passwordOpen} onOpenChange={setPasswordOpen} />
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
