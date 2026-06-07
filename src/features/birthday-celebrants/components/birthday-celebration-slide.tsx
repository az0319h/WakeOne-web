'use client';

import { Badge } from '@/components/ui/badge';
import { Icons } from '@/components/icons';
import { ProfileAvatar } from '@/features/auth/components/profile-display';
import { formatBirthdayMonthDay } from '@/lib/format';
import { cn } from '@/lib/utils';

interface BirthdayCelebrationSlideProps {
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  birthday: string;
  month: number;
  className?: string;
}

export function BirthdayCelebrationSlide({
  firstName,
  lastName,
  avatarUrl,
  birthday,
  month,
  className
}: BirthdayCelebrationSlideProps) {
  const fullName = `${firstName} ${lastName}`.trim();
  const displayName = fullName || '이름 미설정';
  const birthdayLabel = formatBirthdayMonthDay(birthday);

  return (
    <div className={cn('relative px-6 py-8 text-center sm:px-10 sm:py-10', className)}>
      <Icons.sparkles
        aria-hidden
        className='text-muted-foreground/20 pointer-events-none absolute top-5 left-5 size-4'
      />
      <Icons.sparkles
        aria-hidden
        className='text-muted-foreground/15 pointer-events-none absolute right-5 bottom-5 size-3.5'
      />

      <Badge variant='outline' className='mb-5'>
        <Icons.sparkles className='text-muted-foreground size-3.5' />
        {month}월 생일
      </Badge>

      <div className='border-border/60 bg-muted/30 mx-auto mb-5 flex size-20 items-center justify-center rounded-full border-2 sm:size-24'>
        <ProfileAvatar
          profile={{
            first_name: firstName,
            last_name: lastName,
            email: '',
            avatar_url: avatarUrl
          }}
          className='size-14 sm:size-16'
          fallbackClassName='bg-muted text-foreground text-lg font-semibold'
        />
      </div>

      <h3 className='text-foreground text-xl font-bold tracking-tight sm:text-2xl'>
        {displayName}님, 생일을 축하해요!
      </h3>
      <p className='text-muted-foreground mx-auto mt-2 max-w-md text-sm leading-relaxed sm:text-base'>
        {birthdayLabel ? (
          <>
            <span className='text-foreground font-medium'>{birthdayLabel}</span>
            {' · '}팀원들이 함께 축하합니다.
          </>
        ) : (
          '팀원들이 함께 축하합니다.'
        )}
      </p>
    </div>
  );
}
