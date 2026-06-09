import { apiClientWithMessage } from '@/lib/api-client';
import type {
  OfficeSnackCandidate,
  OfficeSnackCandidateUpsertPayload,
  OfficeSnackResult,
  OfficeSnackSession,
  OfficeSnackSessionCreatePayload,
  OfficeSnackSessionDetail,
  OfficeSnackSessionUpdatePayload,
  OfficeSnackVote,
  OfficeSnackVoteSubmitPayload
} from './types';

type OfficeSnackSessionsResponse = {
  success: boolean;
  message: string;
  sessions: OfficeSnackSession[];
};

type OfficeSnackSessionDetailResponse = {
  success: boolean;
  message: string;
} & OfficeSnackSessionDetail;

export async function listOfficeSnackSessions(): Promise<OfficeSnackSession[]> {
  const response = await apiClientWithMessage<OfficeSnackSessionsResponse>('/office-snacks/sessions');
  return response.sessions;
}

export async function getOfficeSnackSessionDetail(
  sessionId: number
): Promise<OfficeSnackSessionDetail> {
  const response = await apiClientWithMessage<OfficeSnackSessionDetailResponse>(
    `/office-snacks/sessions/${sessionId}`
  );
  return {
    session: response.session,
    candidates: response.candidates,
    my_candidate: response.my_candidate,
    my_vote: response.my_vote,
    results: response.results
  };
}

export async function createOfficeSnackSession(payload: OfficeSnackSessionCreatePayload) {
  return apiClientWithMessage<{ success: boolean; message: string; session: OfficeSnackSession }>(
    '/office-snacks/sessions',
    {
      method: 'POST',
      body: JSON.stringify(payload)
    }
  );
}

export async function updateOfficeSnackSession(
  sessionId: number,
  payload: OfficeSnackSessionUpdatePayload
) {
  return apiClientWithMessage<{ success: boolean; message: string; session: OfficeSnackSession }>(
    `/office-snacks/sessions/${sessionId}`,
    {
      method: 'PATCH',
      body: JSON.stringify(payload)
    }
  );
}

export async function deleteOfficeSnackSession(sessionId: number) {
  return apiClientWithMessage<{ success: boolean; message: string; session: OfficeSnackSession }>(
    `/office-snacks/sessions/${sessionId}`,
    {
      method: 'DELETE'
    }
  );
}

export async function createOfficeSnackCandidate(
  sessionId: number,
  payload: OfficeSnackCandidateUpsertPayload
) {
  return apiClientWithMessage<{ success: boolean; message: string; candidate: OfficeSnackCandidate }>(
    `/office-snacks/sessions/${sessionId}/candidates`,
    {
      method: 'POST',
      body: JSON.stringify(payload)
    }
  );
}

export async function updateOfficeSnackCandidate(
  candidateId: number,
  payload: OfficeSnackCandidateUpsertPayload
) {
  return apiClientWithMessage<{ success: boolean; message: string; candidate: OfficeSnackCandidate }>(
    `/office-snacks/candidates/${candidateId}`,
    {
      method: 'PATCH',
      body: JSON.stringify(payload)
    }
  );
}

export async function deleteOfficeSnackCandidate(candidateId: number) {
  return apiClientWithMessage<{ success: boolean; message: string; candidate: OfficeSnackCandidate }>(
    `/office-snacks/candidates/${candidateId}`,
    {
      method: 'DELETE'
    }
  );
}

export async function submitOfficeSnackVote(sessionId: number, payload: OfficeSnackVoteSubmitPayload) {
  return apiClientWithMessage<{ success: boolean; message: string; vote: OfficeSnackVote }>(
    `/office-snacks/sessions/${sessionId}/votes`,
    {
      method: 'POST',
      body: JSON.stringify(payload)
    }
  );
}

export async function listOfficeSnackResults(sessionId: number): Promise<OfficeSnackResult[]> {
  const detail = await getOfficeSnackSessionDetail(sessionId);
  return detail.results;
}
