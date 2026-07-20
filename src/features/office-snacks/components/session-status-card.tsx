import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { OfficeSnackSession } from '../api/types';
import { formatAbsoluteDateTimeKo } from '@/lib/format-datetime';
import { getSessionStateLabel } from './office-snack-utils';

interface SessionStatusCardProps {
  session: OfficeSnackSession;
}

export function SessionStatusCard({ session }: SessionStatusCardProps) {
  return (
    <Card>
      <CardHeader className='pb-3'>
        <div className='flex items-center justify-between gap-2'>
          <CardTitle className='text-base'>{session.title}</CardTitle>
          <Badge variant='outline'>{getSessionStateLabel(session.state)}</Badge>
        </div>
        {session.description ? (
          <p className='text-muted-foreground text-sm'>{session.description}</p>
        ) : null}
      </CardHeader>
      <CardContent className='grid gap-2 text-sm md:grid-cols-2'>
        <div>
          <p className='text-muted-foreground'>등록 기간</p>
          <p>
            {formatAbsoluteDateTimeKo(session.registration_start_at)} ~{' '}
            {formatAbsoluteDateTimeKo(session.registration_end_at)}
          </p>
        </div>
        <div>
          <p className='text-muted-foreground'>투표 기간</p>
          <p>
            {formatAbsoluteDateTimeKo(session.voting_start_at)} ~ {formatAbsoluteDateTimeKo(session.voting_end_at)}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
