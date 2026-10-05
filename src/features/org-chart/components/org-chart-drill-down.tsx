'use client';

import { useMemo, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Icons } from '@/components/icons';
import { getInitials } from '@/features/auth/components/profile-display';
import type { Affiliation } from '@/features/users/constants/organization';
import { formatPersonLabel } from '@/features/org-chart/lib/format-person-label';
import { pickLeadershipNodes } from '@/features/org-chart/lib/pick-leadership-nodes';
import { isOrgChartDisplayEmpty } from '../lib/is-chart-empty';
import type { OrgChartNode } from '../api/types';

interface OrgChartDrillDownProps {
  nodes: OrgChartNode[];
  affiliation: Affiliation;
}

function MemberCard({ node }: { node: OrgChartNode }) {
  const fullName = node.fullName ?? node.name;
  const positionLevel = node.positionLevel ?? '';
  const label = formatPersonLabel({
    fullName,
    positionLevel,
    leaderRole: node.leaderRole
  });

  return (
    <Card>
      <CardContent className='flex items-center gap-3 p-4'>
        <Avatar className='h-10 w-10'>
          {node.avatarUrl ? (
            <AvatarImage src={node.avatarUrl} alt={fullName} />
          ) : null}
          <AvatarFallback className='text-xs'>
            {getInitials({ full_name: fullName, email: fullName })}
          </AvatarFallback>
        </Avatar>
        <div className='min-w-0'>
          <p className='truncate text-sm font-medium'>{label}</p>
          {node.rank ? (
            <p className='text-muted-foreground truncate text-xs'>{node.rank}</p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

export function OrgChartDrillDown({ nodes, affiliation }: OrgChartDrillDownProps) {
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);

  const leadershipNodes = useMemo(
    () => pickLeadershipNodes(nodes, affiliation),
    [nodes, affiliation]
  );

  const teamNodes = useMemo(
    () => nodes.filter((node) => node.nodeType === 'team'),
    [nodes]
  );

  const membersByTeam = useMemo(() => {
    const map = new Map<string, OrgChartNode[]>();
    for (const node of nodes) {
      if (node.nodeType !== 'person' || !node.parentId) continue;
      const parent = nodes.find((candidate) => candidate.id === node.parentId);
      if (parent?.nodeType !== 'team') continue;
      const list = map.get(node.parentId) ?? [];
      list.push(node);
      map.set(node.parentId, list);
    }
    return map;
  }, [nodes]);

  const selectedTeam = teamNodes.find((team) => team.id === selectedTeamId);
  const selectedMembers = selectedTeamId
    ? (membersByTeam.get(selectedTeamId) ?? [])
    : [];

  if (
    isOrgChartDisplayEmpty(nodes) ||
    (teamNodes.length === 0 && leadershipNodes.length === 0)
  ) {
    return (
      <div className='text-muted-foreground flex flex-col items-center gap-2 px-4 py-8 text-center text-sm'>
        <p>표시할 임직원이 없습니다.</p>
        <p className='text-xs'>
          사용자 관리에서 직급을 설정하면 조직도에 표시됩니다.
        </p>
      </div>
    );
  }

  if (selectedTeam) {
    return (
      <div className='flex flex-1 flex-col gap-4'>
        <Button
          type='button'
          variant='ghost'
          size='sm'
          className='w-fit'
          onClick={() => setSelectedTeamId(null)}
        >
          <Icons.chevronLeft className='mr-1 h-4 w-4' />
          팀 목록
        </Button>

        <div>
          <h3 className='text-lg font-semibold'>{selectedTeam.name}</h3>
          <p className='text-muted-foreground text-sm'>
            {selectedMembers.length}명
          </p>
        </div>

        {selectedMembers.length === 0 ? (
          <p className='text-muted-foreground text-sm'>구성원이 없습니다</p>
        ) : (
          <div className='flex flex-col gap-3'>
            {selectedMembers.map((member) => (
              <MemberCard key={member.id} node={member} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className='flex flex-col gap-6'>
      {leadershipNodes.length > 0 ? (
        <section data-testid='org-chart-leadership'>
          <h3 className='text-muted-foreground mb-3 text-sm font-medium'>경영진</h3>
          <div className='flex flex-col gap-3'>
            {leadershipNodes.map((leader) => (
              <MemberCard key={leader.id} node={leader} />
            ))}
          </div>
        </section>
      ) : null}

      {teamNodes.length > 0 ? (
        <section data-testid='org-chart-teams'>
          {leadershipNodes.length > 0 ? (
            <h3 className='text-muted-foreground mb-3 text-sm font-medium'>팀</h3>
          ) : null}
          <div className='grid gap-3'>
            {teamNodes.map((team) => {
              const memberCount = membersByTeam.get(team.id)?.length ?? 0;

              return (
                <Card
                  key={team.id}
                  className='cursor-pointer transition-colors hover:bg-muted/40'
                  onClick={() => setSelectedTeamId(team.id)}
                >
                  <CardHeader className='flex flex-row items-center justify-between space-y-0 p-4'>
                    <CardTitle className='text-base font-medium'>{team.name}</CardTitle>
                    <div className='text-muted-foreground flex items-center gap-2 text-sm'>
                      <span>{memberCount}명</span>
                      <Icons.chevronRight className='h-4 w-4' />
                    </div>
                  </CardHeader>
                </Card>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}
