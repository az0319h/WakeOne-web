import type { ActivityAction } from '../../api/types';
import { ACTION_LABELS } from '../../labels';

export const ACTION_OPTIONS: { value: ActivityAction; label: string }[] = (
  Object.entries(ACTION_LABELS) as [ActivityAction, string][]
).map(([value, label]) => ({ value, label }));
