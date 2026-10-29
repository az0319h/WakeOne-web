import { mutationOptions } from '@tanstack/react-query';
import { getQueryClient } from '@/lib/query-client';
import { subscriptionKeys } from './keys';
import { createSubscription, deleteSubscription, updateSubscription } from './service';
import type { SubscriptionPayload } from './types';

/** 대장 CUD → 대장 목록·단건 invalidate (designer §14-12) */
function invalidateSubscriptions() {
  getQueryClient().invalidateQueries({ queryKey: subscriptionKeys.all });
}

export const createSubscriptionMutation = mutationOptions({
  mutationFn: (payload: SubscriptionPayload) => createSubscription(payload),
  onSettled: invalidateSubscriptions
});

export const updateSubscriptionMutation = mutationOptions({
  mutationFn: ({ id, payload }: { id: number; payload: Partial<SubscriptionPayload> }) =>
    updateSubscription(id, payload),
  onSettled: invalidateSubscriptions
});

export const deleteSubscriptionMutation = mutationOptions({
  mutationFn: (id: number) => deleteSubscription(id),
  onSettled: invalidateSubscriptions
});
