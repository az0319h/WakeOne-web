'use client';

import { Icons } from '@/components/icons';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger
} from '@/components/ui/select';
import { LedgerToneBadge } from '@/features/asset-ledger/components/asset-status-badge';
import { cn } from '@/lib/utils';

const ALL_VALUE = 'all';

type SubscriptionCardFilterProps = {
  value: string | null;
  /** 목록 응답 `card_options`(권한자만) — 아직 없으면 빈 배열 */
  options: string[];
  onChange: (next: string | null) => void;
  variant: 'desktop' | 'mobile';
};

/**
 * 「결제 카드」 필터 (plan D-4 · AC-13) — **권한자에게만 렌더**(직원은 URL에 `card`가 있어도 요청에서 뺀다).
 * 항목 「끝 1234」 · 첫 항목 「전체 카드」.
 */
export function SubscriptionCardFilter({ value, options, onChange, variant }: SubscriptionCardFilterProps) {
  const isMobile = variant === 'mobile';
  const list = value && !options.includes(value) ? [value, ...options] : options;

  const select = (
    <Select
      value={value ?? ALL_VALUE}
      onValueChange={(next) => onChange(next === ALL_VALUE ? null : next)}
    >
      <SelectTrigger
        id={isMobile ? 'subscription-card-filter-mobile' : undefined}
        data-testid={isMobile ? 'subscription-card-filter-mobile' : 'subscription-card-filter'}
        aria-label='결제 카드'
        className={cn(
          isMobile ? 'h-11 w-full' : 'h-9 w-auto border-dashed',
          value && !isMobile && 'border-solid'
        )}
      >
        <span className='flex min-w-0 items-center gap-2'>
          <Icons.creditCard aria-hidden className='size-4 text-muted-foreground' />
          <span>결제 카드</span>
          {value ? <span className='font-mono font-medium tabular-nums'>끝 {value}</span> : null}
          <LedgerToneBadge tone='violet'>
            <Icons.lock aria-hidden className='size-3' />
            권한자만
          </LedgerToneBadge>
        </span>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_VALUE}>전체 카드</SelectItem>
        {list.map((last4) => (
          <SelectItem
            key={last4}
            value={last4}
            data-testid={`subscription-card-option${isMobile ? '-mobile' : ''}-${last4}`}
          >
            끝 {last4}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  if (!isMobile) return select;

  return (
    <div className='space-y-2'>
      <Label htmlFor='subscription-card-filter-mobile' className='text-sm font-semibold'>
        결제 카드
      </Label>
      {select}
    </div>
  );
}
