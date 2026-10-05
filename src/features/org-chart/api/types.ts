import type { Affiliation } from '@/features/users/constants/organization';
import type { LeaderRole } from '@/features/users/constants/organization';

export type OrgChartNodeType = 'person' | 'team' | 'root';

export type OrgChartNode = {
  id: string;
  parentId: string | null;
  name: string;
  nodeType: OrgChartNodeType;
  userId?: string;
  fullName?: string;
  positionLevel?: string;
  leaderRole?: LeaderRole | null;
  rank?: string | null;
  avatarUrl?: string | null;
};

export type OrgChartResponse = {
  success: true;
  affiliation: Affiliation;
  nodes: OrgChartNode[];
};

export type OrgChartProfile = {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  affiliation: Affiliation;
  rank: string | null;
  position_level: string;
  leader_role: LeaderRole | null;
  system_role: 'user';
  status: 'active';
};
