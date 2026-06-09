import 'server-only';

import type { OfficeSnackSessionState } from './types';

const KST_TIMEZONE = 'Asia/Seoul';

function toKstDate(date: Date): Date {
  const formatted = date.toLocaleString('en-US', { timeZone: KST_TIMEZONE });
  return new Date(formatted);
}

export function getKstNow(): Date {
  return toKstDate(new Date());
}

export function computeOfficeSnackSessionState(input: {
  registrationStartAt: string;
  registrationEndAt: string;
  votingStartAt: string;
  votingEndAt: string;
  now?: Date;
}): OfficeSnackSessionState {
  const now = input.now ?? getKstNow();
  const registrationStart = toKstDate(new Date(input.registrationStartAt));
  const registrationEnd = toKstDate(new Date(input.registrationEndAt));
  const votingStart = toKstDate(new Date(input.votingStartAt));
  const votingEnd = toKstDate(new Date(input.votingEndAt));

  if (now < registrationStart) {
    return 'upcoming';
  }

  if (now >= registrationStart && now < registrationEnd) {
    return 'registration';
  }

  if (now >= votingStart && now < votingEnd) {
    return 'voting';
  }

  return 'closed';
}
