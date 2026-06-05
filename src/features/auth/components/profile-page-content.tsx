'use client';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import type { AuthProfile } from '@/features/auth/api/types';
import { ProfileForm } from './profile-form';
import { ProfileSecuritySection } from './profile-security-section';

interface ProfilePageContentProps {
  profile: AuthProfile;
}

function getInitials(profile: AuthProfile) {
  const first = profile.first_name?.trim().charAt(0) ?? '';
  const last = profile.last_name?.trim().charAt(0) ?? '';
  const fromName = `${first}${last}`.toUpperCase();
  if (fromName) {
    return fromName;
  }
  return profile.email.charAt(0).toUpperCase();
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
        description='계정에 표시되는 기본 정보입니다.'
      >
        <div className='flex items-center gap-4'>
          <Avatar className='h-16 w-16'>
            <AvatarFallback className='text-lg'>{getInitials(profile)}</AvatarFallback>
          </Avatar>
          <div className='min-w-0'>
            <p className='font-medium'>
              {profile.first_name} {profile.last_name}
            </p>
            <p className='text-muted-foreground truncate text-sm'>{profile.email}</p>
          </div>
        </div>
      </ProfileSection>

      <Separator />

      <ProfileSection
        title='계정 정보'
        description='이름과 연락처를 수정할 수 있습니다. 이메일은 변경할 수 없습니다.'
      >
        <ProfileForm profile={profile} />
      </ProfileSection>

      <Separator />

      <ProfileSection
        title='보안'
        description='비밀번호 변경 및 로그아웃을 관리합니다.'
      >
        <ProfileSecuritySection />
      </ProfileSection>
    </div>
  );
}
