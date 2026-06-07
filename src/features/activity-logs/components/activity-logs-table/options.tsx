import type { ActivityAction } from '../../api/types';

export const ACTION_OPTIONS: { value: ActivityAction; label: string }[] = [
  { value: 'user.invite', label: 'user.invite' },
  { value: 'user.update', label: 'user.update' },
  { value: 'user.reactivate', label: 'user.reactivate' },
  { value: 'user.deactivate', label: 'user.deactivate' },
  { value: 'profile.update', label: 'profile.update' },
  { value: 'profile.password_change', label: 'profile.password_change' }
];
