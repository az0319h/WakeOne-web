/** Dedicated contract-reminder E2E only. kbar/UI specs must NOT POST reminders (real emails). */
/** kbar specs must NOT POST /api/contracts/import — use e2e/helpers/contracts-kbar.ts (read-only). */
export function uniqueRunKey(prefix = 'E2E') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function reminderCronHeaders() {
  const secret = process.env.CRON_SECRET ?? process.env.CONTRACT_REMINDER_CRON_SECRET;
  if (!secret) {
    return undefined;
  }

  return {
    Authorization: `Bearer ${secret}`,
    'Content-Type': 'application/json'
  };
}
