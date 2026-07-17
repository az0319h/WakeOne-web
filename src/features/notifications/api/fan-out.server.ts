import 'server-only';

import { getServiceRoleClient } from '@/lib/supabase/service-role';
import {
  filterMonitoredFields,
  formatUserUpdateBody,
  USER_UPDATE_NOTIFICATION_TITLE
} from './labels';

type InsertUserUpdateNotificationInput = {
  recipientUserId: string;
  changedFields: string[];
  actorUserId: string;
};

export async function insertUserUpdateNotification(
  input: InsertUserUpdateNotificationInput
): Promise<void> {
  const monitored = filterMonitoredFields(input.changedFields);

  if (monitored.length === 0) {
    return;
  }

  if (input.actorUserId === input.recipientUserId) {
    return;
  }

  const supabase = getServiceRoleClient();
  const { error } = await supabase.from('notifications').insert({
    recipient_user_id: input.recipientUserId,
    type: 'user.update',
    title: USER_UPDATE_NOTIFICATION_TITLE,
    body: formatUserUpdateBody(monitored),
    metadata: {
      changed_fields: monitored,
      kind: 'user.update'
    }
  });

  if (error) {
    throw new Error(error.message);
  }
}
