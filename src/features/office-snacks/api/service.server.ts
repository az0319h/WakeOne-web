import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { getServiceRoleClient } from '@/lib/supabase/service-role';
import { computeOfficeSnackSessionState, getKstNow } from './time.server';
import { isCoupangAllowedHost } from './validators';
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

type OfficeSnackSessionRow = {
  id: number;
  title: string;
  description: string | null;
  registration_start_at: string;
  registration_end_at: string;
  voting_start_at: string;
  voting_end_at: string;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
};

type OfficeSnackCandidateRow = {
  id: number;
  session_id: number;
  owner_user_id: string;
  name: string;
  product_url: string;
  image_url: string | null;
  price: number;
  source_type: 'parsed' | 'manual';
  created_at: string;
  updated_at: string;
};

type OfficeSnackVoteRow = {
  id: number;
  session_id: number;
  voter_user_id: string;
  rank1_candidate_id: number;
  rank2_candidate_id: number;
  rank3_candidate_id: number;
  created_at: string;
};

type OfficeSnackResultRow = {
  session_id: number;
  candidate_id: number;
  candidate_name: string;
  product_url: string;
  image_url: string | null;
  price: number;
  owner_user_id: string;
  candidate_created_at: string;
  rank1_score: number;
  rank2_score: number;
  rank3_score: number;
  total_score: number;
  rank: number;
};

type CandidateOwnerMap = Map<string, { email: string | null; name: string | null }>;

function mapSession(row: OfficeSnackSessionRow): OfficeSnackSession {
  return {
    ...row,
    state: computeOfficeSnackSessionState({
      registrationStartAt: row.registration_start_at,
      registrationEndAt: row.registration_end_at,
      votingStartAt: row.voting_start_at,
      votingEndAt: row.voting_end_at
    })
  };
}

async function buildCandidateOwnerMap(ownerIds: string[]): Promise<CandidateOwnerMap> {
  if (ownerIds.length === 0) {
    return new Map();
  }

  const supabase = getServiceRoleClient();
  const { data } = await supabase
    .from('profiles')
    .select('user_id, email, first_name, last_name')
    .in('user_id', ownerIds);

  const map: CandidateOwnerMap = new Map();
  for (const row of data ?? []) {
    const fullName = `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim();
    map.set(row.user_id, {
      email: row.email ?? null,
      name: fullName || null
    });
  }

  return map;
}

async function mapCandidates(rows: OfficeSnackCandidateRow[]): Promise<OfficeSnackCandidate[]> {
  const ownerMap = await buildCandidateOwnerMap(
    Array.from(new Set(rows.map((row) => row.owner_user_id)))
  );

  return rows.map((row) => {
    const owner = ownerMap.get(row.owner_user_id);
    return {
      ...row,
      owner_email: owner?.email ?? null,
      owner_name: owner?.name ?? null
    };
  });
}

export async function listOfficeSnackSessions(): Promise<OfficeSnackSession[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('office_snack_sessions')
    .select('*')
    .order('voting_end_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data as OfficeSnackSessionRow[]).map(mapSession);
}

async function getOfficeSnackSessionRow(sessionId: number): Promise<OfficeSnackSessionRow | null> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from('office_snack_sessions')
    .select('*')
    .eq('id', sessionId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as OfficeSnackSessionRow | null) ?? null;
}

export async function createOfficeSnackSession(
  payload: OfficeSnackSessionCreatePayload,
  actorUserId: string
): Promise<OfficeSnackSession> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from('office_snack_sessions')
    .insert({
      ...payload,
      created_by: actorUserId,
      updated_by: actorUserId
    })
    .select('*')
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapSession(data as OfficeSnackSessionRow);
}

export async function updateOfficeSnackSession(
  sessionId: number,
  payload: OfficeSnackSessionUpdatePayload,
  actorUserId: string
): Promise<OfficeSnackSession | null> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from('office_snack_sessions')
    .update({
      ...payload,
      updated_by: actorUserId
    })
    .eq('id', sessionId)
    .select('*')
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  return mapSession(data as OfficeSnackSessionRow);
}

export async function deleteOfficeSnackSession(sessionId: number): Promise<OfficeSnackSession | null> {
  const existing = await getOfficeSnackSessionRow(sessionId);
  if (!existing) {
    return null;
  }

  const state = computeOfficeSnackSessionState({
    registrationStartAt: existing.registration_start_at,
    registrationEndAt: existing.registration_end_at,
    votingStartAt: existing.voting_start_at,
    votingEndAt: existing.voting_end_at
  });

  if (state === 'closed') {
    throw new Error('SESSION_DELETE_FORBIDDEN');
  }

  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from('office_snack_sessions')
    .delete()
    .eq('id', sessionId)
    .select('*')
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  return mapSession(data as OfficeSnackSessionRow);
}

async function listSessionCandidatesRows(sessionId: number): Promise<OfficeSnackCandidateRow[]> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from('office_snack_candidates')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data as OfficeSnackCandidateRow[]) ?? [];
}

async function getMyVote(sessionId: number, userId: string): Promise<OfficeSnackVote | null> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from('office_snack_votes')
    .select('*')
    .eq('session_id', sessionId)
    .eq('voter_user_id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as OfficeSnackVoteRow | null) ?? null;
}

export async function listOfficeSnackResults(sessionId: number): Promise<OfficeSnackResult[]> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from('office_snack_results')
    .select('*')
    .eq('session_id', sessionId)
    .order('rank', { ascending: true })
    .order('total_score', { ascending: false })
    .order('candidate_created_at', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data as OfficeSnackResultRow[]) ?? [];
  const ownerMap = await buildCandidateOwnerMap(
    Array.from(new Set(rows.map((row) => row.owner_user_id)))
  );

  return rows.map((row) => {
    const owner = ownerMap.get(row.owner_user_id);
    return {
      ...row,
      owner_email: owner?.email ?? null,
      owner_name: owner?.name ?? null
    };
  });
}

export async function getOfficeSnackSessionDetail(input: {
  sessionId: number;
  userId: string;
}): Promise<OfficeSnackSessionDetail | null> {
  const row = await getOfficeSnackSessionRow(input.sessionId);
  if (!row) {
    return null;
  }

  const session = mapSession(row);
  const candidatesRows = await listSessionCandidatesRows(input.sessionId);
  const candidates = await mapCandidates(candidatesRows);
  const myCandidate = candidates.find((candidate) => candidate.owner_user_id === input.userId) ?? null;
  const myVote = await getMyVote(input.sessionId, input.userId);
  const results = session.state === 'closed' ? await listOfficeSnackResults(input.sessionId) : [];

  return {
    session,
    candidates,
    my_candidate: myCandidate,
    my_vote: myVote,
    results
  };
}

async function requireRegistrationState(sessionId: number): Promise<OfficeSnackSessionRow> {
  const session = await getOfficeSnackSessionRow(sessionId);
  if (!session) {
    throw new Error('SESSION_NOT_FOUND');
  }

  const state = computeOfficeSnackSessionState({
    registrationStartAt: session.registration_start_at,
    registrationEndAt: session.registration_end_at,
    votingStartAt: session.voting_start_at,
    votingEndAt: session.voting_end_at
  });

  if (state !== 'registration') {
    throw new Error('REGISTRATION_CLOSED');
  }

  return session;
}

export async function createOfficeSnackCandidate(input: {
  sessionId: number;
  userId: string;
  payload: OfficeSnackCandidateUpsertPayload;
}): Promise<OfficeSnackCandidate> {
  await requireRegistrationState(input.sessionId);

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(input.payload.product_url.trim());
  } catch {
    throw new Error('INVALID_URL');
  }
  if (!isCoupangAllowedHost(parsedUrl.hostname)) {
    throw new Error('INVALID_DOMAIN');
  }

  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from('office_snack_candidates')
    .insert({
      session_id: input.sessionId,
      owner_user_id: input.userId,
      name: input.payload.name,
      product_url: parsedUrl.toString(),
      image_url: input.payload.image_url ?? null,
      price: input.payload.price,
      source_type: input.payload.source_type ?? 'manual'
    })
    .select('*')
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const mapped = await mapCandidates([data as OfficeSnackCandidateRow]);
  return mapped[0];
}

async function getCandidateRow(candidateId: number): Promise<OfficeSnackCandidateRow | null> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from('office_snack_candidates')
    .select('*')
    .eq('id', candidateId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as OfficeSnackCandidateRow | null) ?? null;
}

export async function updateOfficeSnackCandidate(input: {
  candidateId: number;
  userId: string;
  isAdmin: boolean;
  payload: OfficeSnackCandidateUpsertPayload;
}): Promise<OfficeSnackCandidate | null> {
  const existing = await getCandidateRow(input.candidateId);
  if (!existing) {
    return null;
  }

  if (!input.isAdmin && existing.owner_user_id !== input.userId) {
    throw new Error('FORBIDDEN_CANDIDATE');
  }

  await requireRegistrationState(existing.session_id);

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(input.payload.product_url.trim());
  } catch {
    throw new Error('INVALID_URL');
  }
  if (!isCoupangAllowedHost(parsedUrl.hostname)) {
    throw new Error('INVALID_DOMAIN');
  }

  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from('office_snack_candidates')
    .update({
      name: input.payload.name,
      product_url: parsedUrl.toString(),
      image_url: input.payload.image_url ?? null,
      price: input.payload.price,
      source_type: input.payload.source_type ?? 'manual'
    })
    .eq('id', input.candidateId)
    .select('*')
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  const mapped = await mapCandidates([data as OfficeSnackCandidateRow]);
  return mapped[0];
}

export async function deleteOfficeSnackCandidate(input: {
  candidateId: number;
  userId: string;
  isAdmin: boolean;
}): Promise<OfficeSnackCandidate | null> {
  const existing = await getCandidateRow(input.candidateId);
  if (!existing) {
    return null;
  }

  if (!input.isAdmin && existing.owner_user_id !== input.userId) {
    throw new Error('FORBIDDEN_CANDIDATE');
  }

  await requireRegistrationState(existing.session_id);

  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from('office_snack_candidates')
    .delete()
    .eq('id', input.candidateId)
    .select('*')
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  const mapped = await mapCandidates([data as OfficeSnackCandidateRow]);
  return mapped[0];
}

async function requireVotingState(sessionId: number): Promise<OfficeSnackSessionRow> {
  const session = await getOfficeSnackSessionRow(sessionId);
  if (!session) {
    throw new Error('SESSION_NOT_FOUND');
  }

  const state = computeOfficeSnackSessionState({
    registrationStartAt: session.registration_start_at,
    registrationEndAt: session.registration_end_at,
    votingStartAt: session.voting_start_at,
    votingEndAt: session.voting_end_at
  });

  if (state !== 'voting') {
    throw new Error('VOTING_CLOSED');
  }

  return session;
}

export async function submitOfficeSnackVote(input: {
  sessionId: number;
  userId: string;
  payload: OfficeSnackVoteSubmitPayload;
}): Promise<OfficeSnackVote> {
  await requireVotingState(input.sessionId);

  const candidates = await listSessionCandidatesRows(input.sessionId);
  const candidateIds = new Set(candidates.map((candidate) => candidate.id));

  if (
    !candidateIds.has(input.payload.rank1_candidate_id) ||
    !candidateIds.has(input.payload.rank2_candidate_id) ||
    !candidateIds.has(input.payload.rank3_candidate_id)
  ) {
    throw new Error('INVALID_CANDIDATES');
  }

  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from('office_snack_votes')
    .insert({
      session_id: input.sessionId,
      voter_user_id: input.userId,
      rank1_candidate_id: input.payload.rank1_candidate_id,
      rank2_candidate_id: input.payload.rank2_candidate_id,
      rank3_candidate_id: input.payload.rank3_candidate_id
    })
    .select('*')
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as OfficeSnackVote;
}

export function isOfficeSnackSessionClosed(session: OfficeSnackSession): boolean {
  return (
    computeOfficeSnackSessionState({
      registrationStartAt: session.registration_start_at,
      registrationEndAt: session.registration_end_at,
      votingStartAt: session.voting_start_at,
      votingEndAt: session.voting_end_at,
      now: getKstNow()
    }) === 'closed'
  );
}
