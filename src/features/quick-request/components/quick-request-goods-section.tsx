'use client';

import { useStore } from '@tanstack/react-form';
import { QUICK_REQUEST_ITEM_DESCRIPTION_MAX_LENGTH } from '../schemas/quick-request-notify';
import type { QuickRequestOrderForm } from './quick-request-form-api';
import { QuickRequestGoodsSizeGrid } from './quick-request-goods-size-grid';
import { QuickRequestSectionShell } from './quick-request-section-shell';

type QuickRequestGoodsSectionProps = {
  form: QuickRequestOrderForm;
};

export function QuickRequestGoodsSection({ form }: QuickRequestGoodsSectionProps) {
  const showItemDescription = useStore(form.store, (s) => s.values.goodsSize === 'other');

  return (
    <QuickRequestSectionShell id='quick-request-section-goods' title='물품 정보'>
      <div className='space-y-5'>
        <form.AppField name='goodsSize'>{() => <QuickRequestGoodsSizeGrid />}</form.AppField>

        {/* plan 87 r1 — 「기타」 선택 시에만 노출·필수.
            항상 마운트 + hidden: 조건부 마운트 시 TanStack이 unmount에서 meta를 초기화해
            제출 후 다시 나타난 필드의 오류가 표시되지 않는 문제를 피한다 */}
        <div hidden={!showItemDescription}>
          <form.AppField name='itemDescription'>
            {(field) => (
              <field.TextareaField
                label='물품 내용'
                required
                placeholder='예: 철판 2m, 대형 액자 1개…'
                rows={4}
                maxLength={QUICK_REQUEST_ITEM_DESCRIPTION_MAX_LENGTH}
                className='min-h-24 bg-muted/50'
                data-testid='quick-request-item-description'
              />
            )}
          </form.AppField>
        </div>
      </div>
    </QuickRequestSectionShell>
  );
}
