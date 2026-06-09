export const OFFICE_SNACK_MAX_PRICE = 50000;

export type OfficeSnackSessionState = 'upcoming' | 'registration' | 'voting' | 'closed';

export type OfficeSnackSession = {
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
  state: OfficeSnackSessionState;
};

export type OfficeSnackCandidateSourceType = 'parsed' | 'manual';

export type OfficeSnackCandidate = {
  id: number;
  session_id: number;
  owner_user_id: string;
  owner_name: string | null;
  owner_email: string | null;
  name: string;
  product_url: string;
  image_url: string | null;
  price: number;
  source_type: OfficeSnackCandidateSourceType;
  created_at: string;
  updated_at: string;
};

export type OfficeSnackVote = {
  id: number;
  session_id: number;
  voter_user_id: string;
  rank1_candidate_id: number;
  rank2_candidate_id: number;
  rank3_candidate_id: number;
  created_at: string;
};

export type OfficeSnackResult = {
  session_id: number;
  candidate_id: number;
  candidate_name: string;
  product_url: string;
  image_url: string | null;
  price: number;
  owner_user_id: string;
  owner_name: string | null;
  owner_email: string | null;
  candidate_created_at: string;
  rank1_score: number;
  rank2_score: number;
  rank3_score: number;
  total_score: number;
  rank: number;
};

export type OfficeSnackSessionDetail = {
  session: OfficeSnackSession;
  candidates: OfficeSnackCandidate[];
  my_candidate: OfficeSnackCandidate | null;
  my_vote: OfficeSnackVote | null;
  results: OfficeSnackResult[];
};

export type OfficeSnackSessionCreatePayload = {
  title: string;
  description?: string | null;
  registration_start_at: string;
  registration_end_at: string;
  voting_start_at: string;
  voting_end_at: string;
};

export type OfficeSnackSessionUpdatePayload = Partial<OfficeSnackSessionCreatePayload>;

export type OfficeSnackCandidateUpsertPayload = {
  name: string;
  product_url: string;
  image_url: string | null;
  price: number;
  source_type?: OfficeSnackCandidateSourceType;
};

export type OfficeSnackVoteSubmitPayload = {
  rank1_candidate_id: number;
  rank2_candidate_id: number;
  rank3_candidate_id: number;
};

