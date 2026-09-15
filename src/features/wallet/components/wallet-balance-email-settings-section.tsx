'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Icons } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PageLoadingSpinner } from '@/components/ui/page-loading-spinner';
import { cn } from '@/lib/utils';
import { walletBalanceEmailPreferencesQueryOptions } from '../api/queries';
import { formatBalanceEmailScheduleSummary } from '../utils/balance-email-schedule';
import { WalletBalanceEmailSettingsSheet } from './wallet-balance-email-settings-sheet';

interface WalletBalanceEmailSettingsSectionProps {
  targetUser: string;
}

const SETTINGS_HASH = '#wallet-balance-email-settings';

function WalletBalanceEmailSettingsEntry({
  targetUser,
  open,
  onOpenChange
}: WalletBalanceEmailSettingsSectionProps & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const filters = targetUser === 'self' ? {} : { user: targetUser };
  const { data } = useSuspenseQuery(walletBalanceEmailPreferencesQueryOptions(filters));
  const { preferences } = data;

  const scheduleSummary = formatBalanceEmailScheduleSummary(
    preferences.hour,
    preferences.minute,
    preferences.exclude_weekends
  );

  return (
    <>
      {!preferences.enabled ? (
        <div
          className='bg-muted/60 text-muted-foreground flex items-center gap-2 rounded-lg border px-4 py-3 text-sm'
          data-testid='wallet-balance-email-off-banner'
        >
          <Icons.send className='size-4 shrink-0' />
          <span>식대 잔액을 매일 이메일로 받아보세요</span>
        </div>
      ) : null}

      <Card data-testid='wallet-balance-email-settings-entry'>
        <CardContent className='flex items-center justify-between gap-4 p-4'>
          <div className='min-w-0 space-y-1'>
            <p className='text-sm font-medium'>잔액 확인 이메일 알림</p>
            <div
              className='flex flex-wrap items-center gap-2'
              data-testid='wallet-balance-email-settings-entry-summary'
            >
              <Badge variant={preferences.enabled ? 'default' : 'secondary'} className='font-normal'>
                {preferences.enabled ? '켜짐' : '꺼짐'}
              </Badge>
              {preferences.enabled ? (
                <>
                  <span
                    className='text-muted-foreground text-xs'
                    data-testid='wallet-balance-email-settings-entry-schedule'
                  >
                    {scheduleSummary}
                  </span>
                  {preferences.exclude_weekends ? (
                    <Badge
                      variant='outline'
                      className='font-normal'
                      data-testid='wallet-balance-email-settings-entry-weekends'
                    >
                      토·일 제외
                    </Badge>
                  ) : null}
                </>
              ) : (
                <span className='text-muted-foreground text-xs'>알림이 꺼져 있습니다</span>
              )}
            </div>
          </div>
          <Button
            type='button'
            variant='outline'
            size='sm'
            onClick={() => onOpenChange(true)}
            data-testid='wallet-balance-email-settings-open'
          >
            설정
            <Icons.chevronRight className='ml-1 size-4' />
          </Button>
        </CardContent>
      </Card>

      <WalletBalanceEmailSettingsSheet
        targetUser={targetUser}
        open={open}
        onOpenChange={onOpenChange}
      />
    </>
  );
}

export function WalletBalanceEmailSettingsSection({
  targetUser
}: WalletBalanceEmailSettingsSectionProps) {
  const [open, setOpen] = useState(false);

  const syncOpenFromHash = useCallback(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (window.location.hash === SETTINGS_HASH) {
      setOpen(true);
    }
  }, []);

  useEffect(() => {
    syncOpenFromHash();
    window.addEventListener('hashchange', syncOpenFromHash);
    return () => window.removeEventListener('hashchange', syncOpenFromHash);
  }, [syncOpenFromHash]);

  return (
    <section
      id='wallet-balance-email-settings'
      className={cn('scroll-mt-6 space-y-3')}
      data-testid='wallet-balance-email-settings-section'
    >
      <Suspense key={targetUser} fallback={<PageLoadingSpinner variant='compact' />}>
        <WalletBalanceEmailSettingsEntry
          targetUser={targetUser}
          open={open}
          onOpenChange={setOpen}
        />
      </Suspense>
    </section>
  );
}
