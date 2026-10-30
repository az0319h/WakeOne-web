import type { QuickRequestDetail } from '../../api/types';
import { formatQuickAmountWon } from '../../lib/format-quick-amount';
import { QuickDetailSection } from './quick-detail-section';

type AmountRowProps = {
  label: string;
  amount: number | null;
  testId: string;
};

function AmountRow({ label, amount, testId }: AmountRowProps) {
  return (
    <div className='flex min-w-0 items-baseline justify-between gap-3'>
      <dt className='text-sm text-muted-foreground'>{label}</dt>
      <dd data-testid={testId} className='text-lg font-semibold text-foreground tabular-nums'>
        {formatQuickAmountWon(amount)}
      </dd>
    </div>
  );
}

type QuickRequestAmountSectionProps = {
  detail: QuickRequestDetail;
  density?: 'default' | 'compact';
};

/**
 * 「금액」 섹션 (예상·최종 · 부가세 포함 안내) — plan 106 designer §6.2: PC aside·휴대폰 트리 공용으로 꺼냄.
 * testid·문구는 그대로(`quick-detail-section-amount` · `quick-detail-estimated-amount` · `quick-detail-final-amount`).
 */
export function QuickRequestAmountSection({ detail, density }: QuickRequestAmountSectionProps) {
  return (
    <QuickDetailSection title='금액' data-testid='quick-detail-section-amount' density={density}>
      <dl className='flex flex-col gap-2'>
        <AmountRow
          label='예상금액'
          amount={detail.dispatch.estimatedAmount}
          testId='quick-detail-estimated-amount'
        />
        <AmountRow label='최종금액' amount={detail.finalAmount} testId='quick-detail-final-amount' />
      </dl>
      <p className='mt-2 text-xs text-muted-foreground'>예상금액·최종금액은 부가세 포함 금액입니다.</p>
    </QuickDetailSection>
  );
}
