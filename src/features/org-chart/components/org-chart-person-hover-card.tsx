'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger
} from '@/components/ui/hover-card';
import { Icons } from '@/components/icons';
import { getInitials } from '@/features/auth/components/profile-display';
import { formatPhoneDisplay } from '@/lib/phone';
import { cn } from '@/lib/utils';
import type { PersonContactInfo } from '../hooks/use-org-chart-person-hover';

interface OrgChartPersonHoverCardProps {
  open: boolean;
  anchorRect: DOMRect | null;
  contact: PersonContactInfo | null;
}

function displayEmail(email: string | null | undefined) {
  const trimmed = email?.trim();
  return trimmed ? trimmed : '—';
}

function displayPhone(phone: string | null | undefined) {
  return formatPhoneDisplay(phone) ?? '—';
}

export function OrgChartPersonHoverCard({
  open,
  anchorRect,
  contact
}: OrgChartPersonHoverCardProps) {
  if (!open || !anchorRect || !contact) {
    return null;
  }

  const emailDisplay = displayEmail(contact.email);
  const phoneDisplay = displayPhone(contact.phone);
  const emailIsEmpty = emailDisplay === '—';
  const phoneIsEmpty = phoneDisplay === '—';

  const initials = getInitials({
    full_name: contact.fullName,
    email: contact.email?.trim() || contact.fullName
  });

  return (
    <HoverCard open={open}>
      <HoverCardTrigger asChild>
        <span
          aria-hidden
          className='pointer-events-none fixed z-50'
          style={{
            left: anchorRect.left,
            top: anchorRect.top,
            width: anchorRect.width,
            height: anchorRect.height
          }}
        />
      </HoverCardTrigger>
      <HoverCardContent
        data-testid='org-chart-person-hover-card'
        side='right'
        align='start'
        className='w-auto min-w-[240px] max-w-[320px] p-3'
      >
        <div className='flex flex-row items-center gap-3'>
          <Avatar className='h-12 w-12 shrink-0'>
            <AvatarImage src={contact.avatarUrl ?? undefined} alt='' />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className='flex min-w-0 flex-1 flex-col gap-1.5'>
            <div className='flex items-center gap-2 text-sm'>
              <Icons.mail className='text-muted-foreground h-4 w-4 shrink-0' />
              <span className={cn('truncate', emailIsEmpty && 'text-muted-foreground')}>
                {emailDisplay}
              </span>
            </div>
            <div className='flex items-center gap-2 text-sm'>
              <Icons.phone className='text-muted-foreground h-4 w-4 shrink-0' />
              <span className={cn('truncate', phoneIsEmpty && 'text-muted-foreground')}>
                {phoneDisplay}
              </span>
            </div>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
