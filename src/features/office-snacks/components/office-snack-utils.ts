import { formatAbsoluteDateTimeKo } from '@/lib/format-datetime';
import type {
  OfficeSnackCandidate,
  OfficeSnackSession,
  OfficeSnackSessionState
} from '../api/types';

export function formatWon(value: number): string {
  return `${value.toLocaleString('ko-KR')}원`;
}

export const OFFICE_SNACK_PLACEHOLDER_IMAGE_URL =
  'https://static.coupangcdn.com/image/coupang/common/logo_coupang_w350.png';

export function canAdminDeleteOfficeSnackSession(state: OfficeSnackSessionState): boolean {
  return state === 'upcoming' || state === 'registration' || state === 'voting';
}

export function getSessionStateLabel(state: OfficeSnackSessionState): string {
  if (state === 'registration') return '등록 중';
  if (state === 'voting') return '투표 중';
  if (state === 'upcoming') return '예정';
  return '종료';
}

export function getSessionRowDeadline(session: OfficeSnackSession): { label: string; at: string } {
  if (session.state === 'registration') {
    return { label: '등록 마감', at: session.registration_end_at };
  }
  if (session.state === 'voting') {
    return { label: '투표 마감', at: session.voting_end_at };
  }
  if (session.state === 'upcoming') {
    return { label: '등록 시작', at: session.registration_start_at };
  }
  return { label: '종료', at: session.voting_end_at };
}

export function getSessionPeriodStartDescription(session: OfficeSnackSession): string {
  if (session.state === 'registration' || session.state === 'upcoming') {
    return `후보 등록 시작: ${formatAbsoluteDateTimeKo(session.registration_start_at)}`;
  }
  if (session.state === 'voting') {
    return `투표 시작: ${formatAbsoluteDateTimeKo(session.voting_start_at)}`;
  }
  return `종료 시각: ${formatAbsoluteDateTimeKo(session.voting_end_at)}`;
}

export function getSessionPeriodEndDescription(session: OfficeSnackSession): string {
  if (session.state === 'registration' || session.state === 'upcoming') {
    return `후보 등록 마감: ${formatAbsoluteDateTimeKo(session.registration_end_at)}`;
  }
  if (session.state === 'voting') {
    return `투표 마감: ${formatAbsoluteDateTimeKo(session.voting_end_at)}`;
  }
  return `종료 시각: ${formatAbsoluteDateTimeKo(session.voting_end_at)}`;
}

export function getSessionStateDescription(session: OfficeSnackSession): string {
  if (session.state === 'registration') {
    return getSessionPeriodEndDescription(session);
  }
  if (session.state === 'voting') {
    return getSessionPeriodEndDescription(session);
  }
  if (session.state === 'upcoming') {
    return getSessionPeriodStartDescription(session);
  }
  return getSessionPeriodEndDescription(session);
}

export function sortCandidatesByCreatedAt(candidates: OfficeSnackCandidate[]) {
  return [...candidates].sort((a, b) => {
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
}
