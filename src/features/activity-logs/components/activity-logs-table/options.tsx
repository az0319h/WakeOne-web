import type { ActivityAction } from '../../api/types';

export const ACTION_OPTIONS: { value: ActivityAction; label: string }[] = [
  { value: 'user.invite', label: 'user.invite' },
  { value: 'user.update', label: 'user.update' },
  { value: 'user.reactivate', label: 'user.reactivate' },
  { value: 'user.deactivate', label: 'user.deactivate' },
  { value: 'office_snack.session_create', label: 'office_snack.session_create' },
  { value: 'office_snack.session_update', label: 'office_snack.session_update' },
  { value: 'office_snack.session_delete', label: 'office_snack.session_delete' },
  { value: 'office_snack.candidate_create', label: 'office_snack.candidate_create' },
  { value: 'office_snack.candidate_update', label: 'office_snack.candidate_update' },
  { value: 'office_snack.candidate_delete', label: 'office_snack.candidate_delete' },
  { value: 'office_snack.vote_submit', label: 'office_snack.vote_submit' },
  { value: 'asset.create', label: 'asset.create' },
  { value: 'asset.update', label: 'asset.update' },
  { value: 'asset.delete', label: 'asset.delete' },
  { value: 'profile.update', label: 'profile.update' },
  { value: 'profile.password_change', label: 'profile.password_change' }
];
