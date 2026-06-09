import { mutationOptions } from '@tanstack/react-query';
import { getQueryClient } from '@/lib/query-client';
import {
  createOfficeSnackCandidate,
  createOfficeSnackSession,
  deleteOfficeSnackCandidate,
  deleteOfficeSnackSession,
  submitOfficeSnackVote,
  updateOfficeSnackCandidate,
  updateOfficeSnackSession
} from './service';
import { officeSnackKeys } from './queries';
import type {
  OfficeSnackCandidateUpsertPayload,
  OfficeSnackSessionCreatePayload,
  OfficeSnackSessionUpdatePayload,
  OfficeSnackVoteSubmitPayload
} from './types';

export const createOfficeSnackSessionMutation = mutationOptions({
  mutationFn: (payload: OfficeSnackSessionCreatePayload) => createOfficeSnackSession(payload),
  onSettled: () => {
    getQueryClient().invalidateQueries({ queryKey: officeSnackKeys.all });
  }
});

export const updateOfficeSnackSessionMutation = mutationOptions({
  mutationFn: ({
    sessionId,
    payload
  }: {
    sessionId: number;
    payload: OfficeSnackSessionUpdatePayload;
  }) => updateOfficeSnackSession(sessionId, payload),
  onSettled: () => {
    getQueryClient().invalidateQueries({ queryKey: officeSnackKeys.all });
  }
});

export const deleteOfficeSnackSessionMutation = mutationOptions({
  mutationFn: (sessionId: number) => deleteOfficeSnackSession(sessionId),
  onSettled: () => {
    getQueryClient().invalidateQueries({ queryKey: officeSnackKeys.all });
  }
});

export const createOfficeSnackCandidateMutation = mutationOptions({
  mutationFn: ({
    sessionId,
    payload
  }: {
    sessionId: number;
    payload: OfficeSnackCandidateUpsertPayload;
  }) => createOfficeSnackCandidate(sessionId, payload),
  onSettled: () => {
    getQueryClient().invalidateQueries({ queryKey: officeSnackKeys.all });
  }
});

export const updateOfficeSnackCandidateMutation = mutationOptions({
  mutationFn: ({
    candidateId,
    payload
  }: {
    candidateId: number;
    payload: OfficeSnackCandidateUpsertPayload;
  }) => updateOfficeSnackCandidate(candidateId, payload),
  onSettled: () => {
    getQueryClient().invalidateQueries({ queryKey: officeSnackKeys.all });
  }
});

export const deleteOfficeSnackCandidateMutation = mutationOptions({
  mutationFn: (candidateId: number) => deleteOfficeSnackCandidate(candidateId),
  onSettled: () => {
    getQueryClient().invalidateQueries({ queryKey: officeSnackKeys.all });
  }
});

export const submitOfficeSnackVoteMutation = mutationOptions({
  mutationFn: ({
    sessionId,
    payload
  }: {
    sessionId: number;
    payload: OfficeSnackVoteSubmitPayload;
  }) => submitOfficeSnackVote(sessionId, payload),
  onSettled: () => {
    getQueryClient().invalidateQueries({ queryKey: officeSnackKeys.all });
  }
});

