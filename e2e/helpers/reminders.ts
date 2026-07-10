export function uniqueRunKey(prefix = 'E2E') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function reminderCronHeaders() {
  const secret = process.env.CONTRACT_REMINDER_CRON_SECRET;
  if (!secret) {
    return undefined;
  }

  return {
    Authorization: `Bearer ${secret}`,
    'Content-Type': 'application/json'
  };
}
