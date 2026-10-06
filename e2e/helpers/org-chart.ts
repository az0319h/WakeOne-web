import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';
import type { APIRequestContext } from '@playwright/test';

export type OrgChartAffiliation = 'wake' | 'sans' | 'sans_foundry';

export type OrgChartUserOptions = {
  email?: string | null;
  fullName?: string;
  affiliation?: OrgChartAffiliation | null;
  rank?: string | null;
  position_level?: string | null;
  leader_role?: 'team_leader' | 'part_leader' | null;
  system_role?: 'admin' | 'user';
  status?: 'active' | 'inactive' | 'pending_approval' | 'rejected';
  phone?: string | null;
  birthday?: string | null;
  password?: string;
};

export type OrgChartNode = {
  id: string;
  parentId: string | null;
  name: string;
  nodeType: 'person' | 'team' | 'root';
  userId?: string;
  fullName?: string;
  positionLevel?: string;
  leaderRole?: string | null;
  rank?: string | null;
  avatarUrl?: string | null;
  email?: string | null;
  phone?: string | null;
};

export type OrgChartResponse = {
  success: boolean;
  affiliation?: OrgChartAffiliation;
  nodes?: OrgChartNode[];
  message?: string;
};

function loadEnvValue(key: string): string {
  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) {
    return process.env[key]?.trim() ?? '';
  }

  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && match[1] === key) {
      return match[2].trim();
    }
  }

  return process.env[key]?.trim() ?? '';
}

function getServiceRoleClient() {
  const url = loadEnvValue('NEXT_PUBLIC_SUPABASE_URL');
  const serviceKey = loadEnvValue('SUPABASE_SERVICE_ROLE_KEY');

  if (!url || !serviceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for org-chart E2E fixtures.');
  }

  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

export function uniqueOrgChartEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
}

export async function createOrgChartTestUser(
  prefix: string,
  options: OrgChartUserOptions = {}
) {
  const admin = getServiceRoleClient();
  const authEmail =
    options.email === undefined || options.email === null || options.email === ''
      ? uniqueOrgChartEmail(prefix)
      : options.email;
  const password = options.password ?? 'E2eOrgChart9!';

  const { data, error } = await admin.auth.admin.createUser({
    email: authEmail,
    password,
    email_confirm: true
  });

  if (error || !data.user) {
    throw new Error(`Failed to create org-chart test user: ${error?.message ?? 'no user'}`);
  }

  const profileEmail =
    options.email !== undefined ? (options.email ?? '') : authEmail;

  const { error: profileError } = await admin
    .from('profiles')
    .update({
      email: profileEmail,
      full_name: options.fullName ?? 'E2E 조직도',
      affiliation:
        options.affiliation !== undefined ? options.affiliation : 'wake',
      rank: options.rank !== undefined ? options.rank : '마케팅팀',
      position_level:
        options.position_level !== undefined ? options.position_level : '과장',
      leader_role: options.leader_role ?? null,
      system_role: options.system_role ?? 'user',
      birthday: options.birthday === undefined ? '1990-01-01' : options.birthday,
      phone: options.phone === undefined ? '01012345678' : options.phone,
      status: options.status ?? 'active',
      deactivated_at: options.status === 'inactive' ? new Date().toISOString() : null
    })
    .eq('user_id', data.user.id);

  if (profileError) {
    await admin.auth.admin.deleteUser(data.user.id);
    throw new Error(`Failed to update org-chart profile: ${profileError.message}`);
  }

  const fullName = options.fullName ?? 'E2E 조직도';

  return { userId: data.user.id, email: authEmail, password, fullName };
}

export async function fetchOrgChart(
  request: APIRequestContext,
  affiliation: OrgChartAffiliation = 'wake'
) {
  const response = await request.get(`/api/org-chart?affiliation=${affiliation}`);
  const body = (await response.json()) as OrgChartResponse;
  return { response, body };
}

export async function fetchUserProfile(
  request: APIRequestContext,
  userId: string
) {
  const response = await request.get(`/api/users?userId=${userId}&limit=1`);
  const payload = (await response.json()) as {
    users?: Array<Record<string, unknown>>;
  };
  return payload.users?.find((user) => user.id === userId) ?? null;
}

export function personNodes(nodes: OrgChartNode[]) {
  return nodes.filter((node) => node.nodeType === 'person');
}

export function teamNode(nodes: OrgChartNode[], teamName: string) {
  return nodes.find((node) => node.nodeType === 'team' && node.name === teamName);
}

export function membersOfTeam(nodes: OrgChartNode[], teamName: string) {
  const team = teamNode(nodes, teamName);
  if (!team) return [];
  return personNodes(nodes).filter((node) => node.parentId === team.id);
}

export async function readCanvasInnerText(
  canvas: { innerText: () => Promise<string> }
) {
  return canvas.innerText();
}
