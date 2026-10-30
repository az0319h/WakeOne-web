'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { ProfileAvatar, ReadOnlyField } from '@/features/auth/components/profile-display';
import { useNavAccess } from '@/contexts/nav-access';
import { cn } from '@/lib/utils';
import { formatBirthdayDisplay } from '@/lib/format-date';
import { formatPhoneDisplay } from '@/lib/phone';
import { getAffiliationLabel } from '../constants/organization';
import type { User } from '../api/types';
import { UserFormSheet } from './user-form-sheet';
import { useState } from 'react';

interface UserProfileModalProps {
  user: User | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function buildSubtitle(user: User) {
  const parts: string[] = [];
  if (user.rank?.trim()) {
    parts.push(user.rank.trim());
  }
  const affiliationLabel = getAffiliationLabel(user.affiliation);
  if (affiliationLabel) {
    parts.push(affiliationLabel);
  }
  return parts.length > 0 ? parts.join(' · ') : null;
}

export function UserProfileModal({ user, open, onOpenChange }: UserProfileModalProps) {
  const sessionProfile = useNavAccess();
  const currentUserId = sessionProfile?.user_id;
  const [editOpen, setEditOpen] = useState(false);

  if (!user) {
    return null;
  }

  const isSelf = currentUserId === user.id;
  const canEdit = user.status === 'active' && !isSelf;
  const fullName = user.full_name.trim();
  const subtitle = buildSubtitle(user);
  const isActive = user.status === 'active';

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        {/* 본문만 스크롤 · 「조직 정보 수정」 footer는 스크롤 밖 하단 고정 · 768px에서도 좌우 여백 유지 */}
        <DialogContent className='flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(56rem,calc(100%-2rem))]'>
          <div className='min-h-0 flex-1 overflow-y-auto'>
            <div className='from-primary/20 via-primary/10 to-background relative h-16 bg-gradient-to-r md:h-28'>
              <div className='absolute -bottom-8 left-4 md:-bottom-12 md:left-6'>
                <ProfileAvatar
                  profile={user}
                  className='border-background h-16 w-16 border-4 shadow-md md:h-24 md:w-24'
                  fallbackClassName='text-lg md:text-2xl'
                />
              </div>
            </div>

            <div className='space-y-4 px-4 pt-10 pb-4 md:space-y-6 md:px-6 md:pt-16 md:pb-6'>
              <DialogHeader className='space-y-1 text-left'>
                <DialogTitle className='text-xl font-semibold tracking-tight md:text-2xl'>
                  {fullName || user.email}
                </DialogTitle>
                {subtitle ? (
                  <p className='text-muted-foreground text-sm'>{subtitle}</p>
                ) : (
                  <p className='text-muted-foreground text-sm'>미설정</p>
                )}
              </DialogHeader>

              <div className='grid gap-4 md:grid-cols-[1fr_220px] md:gap-6'>
                <div className='space-y-4'>
                  <ReadOnlyField label='이메일' value={user.email} />
                  <ReadOnlyField label='연락처' value={formatPhoneDisplay(user.phone)} />
                  <ReadOnlyField
                    label='생일'
                    value={formatBirthdayDisplay(user.birthday)}
                  />
                  <ReadOnlyField
                    label='소속'
                    value={getAffiliationLabel(user.affiliation)}
                  />
                  <ReadOnlyField label='부서/사업장' value={user.rank} />
                </div>

                <aside className='grid grid-cols-2 gap-4 md:block md:space-y-4'>
                  <div className='space-y-2'>
                    <p className='text-muted-foreground text-sm'>시스템 역할</p>
                    <Badge variant='outline' className='capitalize'>
                      {user.system_role}
                    </Badge>
                  </div>
                  <div className='space-y-2'>
                    <p className='text-muted-foreground text-sm'>계정 상태</p>
                    <Badge variant={isActive ? 'outline' : 'destructive'}>
                      {isActive ? '활성' : '비활성'}
                    </Badge>
                  </div>
                </aside>
              </div>
            </div>
          </div>

          {canEdit ? (
            <DialogFooter className='shrink-0 border-t px-4 py-3 md:px-6 md:py-4'>
              <Button type='button' onClick={() => setEditOpen(true)}>
                조직 정보 수정
              </Button>
            </DialogFooter>
          ) : null}
        </DialogContent>
      </Dialog>

      {canEdit ? (
        <UserFormSheet user={user} open={editOpen} onOpenChange={setEditOpen} />
      ) : null}
    </>
  );
}

interface UserAvatarCellProps {
  user: User;
  onClick: (user: User) => void;
}

export function UserAvatarCell({ user, onClick }: UserAvatarCellProps) {
  return (
    <button
      type='button'
      className={cn(
        'cursor-pointer rounded-full',
        'focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none'
      )}
      aria-label={`${user.full_name} 프로필 보기`}
      onClick={(event) => {
        event.stopPropagation();
        onClick(user);
      }}
    >
      <ProfileAvatar profile={user} className='h-9 w-9' />
    </button>
  );
}
