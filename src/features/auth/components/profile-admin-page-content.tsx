'use client';

import type { AuthProfile } from '@/features/auth/api/types';
import { ProfileAvatar, ReadOnlyField } from './profile-display';

interface ProfileAdminPageContentProps {
  profile: AuthProfile;
}

export function ProfileAdminPageContent({ profile }: ProfileAdminPageContentProps) {
  return (
    <div className='mx-auto flex w-full max-w-3xl flex-col gap-8'>
      <section className='space-y-4'>
        <div>
          <h2 className='text-lg font-semibold tracking-tight'>프로필</h2>
          <p className='text-muted-foreground text-sm'>
            관리자 계정의 기본 정보입니다.
          </p>
        </div>
        <div className='flex items-center gap-4'>
          <ProfileAvatar
            profile={profile}
            className='h-16 w-16'
            fallbackClassName='text-lg'
          />
          <div className='min-w-0 space-y-1'>
            <ReadOnlyField label='이메일' value={profile.email} />
            <ReadOnlyField label='이름' value={profile.full_name} />
          </div>
        </div>
      </section>
    </div>
  );
}
