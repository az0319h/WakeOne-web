'use client';

import { Separator } from '@/components/ui/separator';
import type { AuthProfile } from '@/features/auth/api/types';
import { getAffiliationLabel } from '@/features/users/constants/organization';
import { ProfileAvatar, ReadOnlyField } from './profile-display';
import { ProfileForm } from './profile-form';

interface ProfilePageContentProps {
  profile: AuthProfile;
}

function ProfileSection({
  title,
  description,
  children
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className='space-y-4'>
      <div>
        <h2 className='text-lg font-semibold tracking-tight'>{title}</h2>
        <p className='text-muted-foreground text-sm'>{description}</p>
      </div>
      {children}
    </section>
  );
}

export function ProfilePageContent({ profile }: ProfilePageContentProps) {
  return (
    <div className='mx-auto flex w-full max-w-3xl flex-col gap-8'>
      <ProfileSection
        title='프로필'
        description='계정에 표시되는 기본 정보입니다. 조직 정보는 관리자만 수정할 수 있습니다.'
      >
        <div className='flex items-center gap-4'>
          <ProfileAvatar
            profile={profile}
            className='h-16 w-16'
            fallbackClassName='text-lg'
          />
          <div className='min-w-0'>
            <p className='text-muted-foreground truncate text-sm'>{profile.email}</p>
          </div>
        </div>
        <div className='grid gap-4 sm:grid-cols-2'>
          <ReadOnlyField label='소속' value={getAffiliationLabel(profile.affiliation)} />
          <ReadOnlyField label='부서' value={profile.department} />
          <ReadOnlyField label='직급' value={profile.rank} />
          <ReadOnlyField label='직책' value={profile.job_title} />
        </div>
      </ProfileSection>

      <Separator />

      <ProfileSection
        title='계정 정보'
        description='이름·연락처·생일·못 먹는 음식을 수정할 수 있습니다. 이메일은 변경할 수 없습니다.'
      >
        <ProfileForm profile={profile} />
      </ProfileSection>
    </div>
  );
}
