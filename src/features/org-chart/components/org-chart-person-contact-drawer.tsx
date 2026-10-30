'use client';

import { Icons } from '@/components/icons';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle
} from '@/components/ui/drawer';
import { getInitials } from '@/features/auth/components/profile-display';
import { formatPhoneDisplay, parsePhoneDigits } from '@/lib/phone';
import type { PersonContactInfo } from '../hooks/use-org-chart-person-hover';

export type OrgChartPersonContact = PersonContactInfo & {
  /** 이름·직급 표시 (formatPersonLabel 결과) */
  label: string;
  rank: string | null;
};

interface OrgChartPersonContactDrawerProps {
  open: boolean;
  /** 닫히는 애니메이션 동안에도 내용을 유지하도록 open과 분리 */
  contact: OrgChartPersonContact | null;
  onOpenChange: (open: boolean) => void;
}

/**
 * 모바일 조직도 트리 — 사람 행을 누르면 연락처(이메일·전화)를 하단 Drawer로 보여 준다.
 * 데스크톱 D3 차트의 hover card(`OrgChartPersonHoverCard`)와 같은 데이터(PersonContactInfo)를 쓴다.
 */
export function OrgChartPersonContactDrawer({
  open,
  contact,
  onOpenChange
}: OrgChartPersonContactDrawerProps) {
  const email = contact?.email?.trim() || null;
  const phoneDisplay = formatPhoneDisplay(contact?.phone);
  const phoneDigits = contact?.phone ? parsePhoneDigits(contact.phone) : '';

  return (
    <Drawer open={open && contact !== null} onOpenChange={onOpenChange}>
      <DrawerContent data-testid='org-chart-person-contact-drawer'>
        {contact ? (
          <>
            <DrawerHeader className='flex-row items-center gap-3 text-left'>
              <Avatar className='size-12 shrink-0'>
                <AvatarImage src={contact.avatarUrl ?? undefined} alt='' />
                <AvatarFallback>
                  {getInitials({
                    full_name: contact.fullName,
                    email: email ?? contact.fullName
                  })}
                </AvatarFallback>
              </Avatar>
              <div className='min-w-0 space-y-1'>
                <DrawerTitle className='truncate'>{contact.label}</DrawerTitle>
                <DrawerDescription className='truncate'>
                  {contact.rank ?? '연락처'}
                </DrawerDescription>
              </div>
            </DrawerHeader>
            <div className='flex flex-col gap-2 px-4'>
              {email ? (
                <Button asChild variant='outline' className='h-11 justify-start'>
                  <a href={`mailto:${email}`}>
                    <Icons.mail className='text-muted-foreground' />
                    <span className='truncate'>{email}</span>
                  </a>
                </Button>
              ) : (
                <Button variant='outline' className='h-11 justify-start' disabled>
                  <Icons.mail className='text-muted-foreground' />
                  이메일 없음
                </Button>
              )}
              {phoneDisplay && phoneDigits ? (
                <Button asChild variant='outline' className='h-11 justify-start'>
                  <a href={`tel:${phoneDigits}`}>
                    <Icons.phone className='text-muted-foreground' />
                    <span className='truncate'>{phoneDisplay}</span>
                  </a>
                </Button>
              ) : (
                <Button variant='outline' className='h-11 justify-start' disabled>
                  <Icons.phone className='text-muted-foreground' />
                  전화번호 없음
                </Button>
              )}
            </div>
            <DrawerFooter>
              <DrawerClose asChild>
                <Button variant='secondary' className='h-11'>
                  닫기
                </Button>
              </DrawerClose>
            </DrawerFooter>
          </>
        ) : null}
      </DrawerContent>
    </Drawer>
  );
}
