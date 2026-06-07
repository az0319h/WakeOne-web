import type { AuthProfile } from '@/features/auth/api/types';
import { ReadOnlyField } from './profile-display';
import { formatBirthdayDisplay } from '@/lib/format';
import { formatPhoneDisplay } from '@/lib/phone';

interface ProfileAccountReadOnlyProps {
  profile: AuthProfile;
}

export function ProfileAccountReadOnly({ profile }: ProfileAccountReadOnlyProps) {
  return (
    <div className='grid gap-4 sm:grid-cols-2'>
      <ReadOnlyField label='이름' value={profile.first_name} />
      <ReadOnlyField label='성' value={profile.last_name} />
      <ReadOnlyField label='연락처' value={formatPhoneDisplay(profile.phone)} />
      <ReadOnlyField label='생일' value={formatBirthdayDisplay(profile.birthday)} />
      <div className='sm:col-span-2'>
        <ReadOnlyField label='못 먹는 음식' value={profile.food_restrictions} />
      </div>
    </div>
  );
}
