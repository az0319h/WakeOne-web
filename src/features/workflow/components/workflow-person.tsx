import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { formatAffiliation, getPersonInitials } from '../lib/person';
import type { WorkflowPersonSummary } from '../api/types';

type PersonLike = {
  full_name: string;
  avatar_url: string | null;
  affiliation_label?: string | null;
  position_level?: string | null;
};

export function WorkflowPersonAvatar({
  person,
  className
}: {
  person: Pick<PersonLike, 'full_name' | 'avatar_url'>;
  className?: string;
}) {
  return (
    <Avatar className={cn('size-8', className)}>
      {person.avatar_url ? <AvatarImage src={person.avatar_url} alt='' /> : null}
      <AvatarFallback className='bg-muted text-[0.7rem] font-medium text-muted-foreground'>
        {getPersonInitials(person.full_name)}
      </AvatarFallback>
    </Avatar>
  );
}

/** 아바타 + 이름 + 소속·직급 (결재선 · 관리자 목록 공용) */
export function WorkflowPersonInfo({ person }: { person: PersonLike }) {
  const affiliation = formatAffiliation(person);
  return (
    <div className='flex min-w-0 flex-1 items-center gap-3'>
      <WorkflowPersonAvatar person={person} />
      <div className='min-w-0'>
        <p className='truncate text-sm font-medium text-foreground'>{person.full_name}</p>
        {affiliation ? (
          <p className='truncate text-xs text-muted-foreground'>{affiliation}</p>
        ) : null}
      </div>
    </div>
  );
}

/** 결재자 아바타 겹침 (최대 3명 + 「+n명」) */
export function ApproverAvatarStack({
  approvers,
  total
}: {
  approvers: WorkflowPersonSummary[];
  total: number;
}) {
  if (approvers.length === 0) return null;
  const rest = total - approvers.length;
  return (
    <div className='flex shrink-0 items-center gap-1.5'>
      <div className='flex -space-x-2'>
        {approvers.map((person) => (
          <span key={person.user_id} title={person.full_name} className='rounded-full ring-2 ring-background'>
            <WorkflowPersonAvatar person={person} className='size-7' />
            <span className='sr-only'>{person.full_name}</span>
          </span>
        ))}
      </div>
      {rest > 0 ? (
        <span className='text-xs text-muted-foreground tabular-nums max-md:hidden'>+{rest}명</span>
      ) : null}
      {/* 휴대폰: hover(title)가 없으므로 첫 승인자 이름을 글자로 (스크린리더는 위 sr-only 이름을 읽는다) */}
      <span aria-hidden className='text-xs text-muted-foreground tabular-nums md:hidden'>
        {approvers[0].full_name}
        {total > 1 ? ` 외 ${total - 1}명` : ''}
      </span>
    </div>
  );
}
