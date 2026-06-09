import { queryOptions } from '@tanstack/react-query';
import {
  getOfficeSnackSessionDetail,
  listOfficeSnackSessions
} from './service';
import type {
  OfficeSnackSession,
  OfficeSnackSessionDetail
} from './types';

export type { OfficeSnackSession, OfficeSnackSessionDetail };

export const officeSnackKeys = {
  all: ['office-snacks'] as const,
  sessions: () => [...officeSnackKeys.all, 'sessions'] as const,
  sessionDetail: (sessionId: number) => [...officeSnackKeys.all, 'session', sessionId] as const
};

export const officeSnackSessionsQueryOptions = () =>
  queryOptions({
    queryKey: officeSnackKeys.sessions(),
    queryFn: () => listOfficeSnackSessions()
  });

export const officeSnackSessionDetailQueryOptions = (sessionId: number) =>
  queryOptions({
    queryKey: officeSnackKeys.sessionDetail(sessionId),
    queryFn: () => getOfficeSnackSessionDetail(sessionId)
  });
