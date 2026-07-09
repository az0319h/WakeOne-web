'use client';

import { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

export type ProfileNameFields = {
  full_name: string;
  email: string;
};

export type ProfileAvatarFields = ProfileNameFields & {
  avatar_url: string | null;
};

export function getInitials(profile: ProfileNameFields) {
  const parts = profile.full_name?.trim().split(/\s+/).filter(Boolean) ?? [];
  const fromName = parts
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase();
  if (fromName) {
    return fromName;
  }
  return profile.email.charAt(0).toUpperCase();
}

export function ReadOnlyField({
  label,
  value
}: {
  label: string;
  value: string | null | undefined;
}) {
  const displayValue = value?.trim() ? value : null;

  return (
    <div className='space-y-1'>
      <p className='text-muted-foreground text-sm'>{label}</p>
      <p className={cn('text-sm', !displayValue && 'text-muted-foreground')}>
        {displayValue ?? '미설정'}
      </p>
    </div>
  );
}

interface ProfileAvatarProps {
  profile: ProfileAvatarFields;
  className?: string;
  fallbackClassName?: string;
}

export function ProfileAvatar({ profile, className, fallbackClassName }: ProfileAvatarProps) {
  const [imageError, setImageError] = useState(false);
  const showImage = Boolean(profile.avatar_url) && !imageError;
  const fullName = profile.full_name?.trim() ?? '';

  return (
    <Avatar className={className}>
      {showImage ? (
        <AvatarImage
          src={profile.avatar_url!}
          alt={fullName || profile.email}
          onError={() => setImageError(true)}
        />
      ) : null}
      <AvatarFallback className={fallbackClassName}>{getInitials(profile)}</AvatarFallback>
    </Avatar>
  );
}
