'use client';

import { QuickRequestOrderPage } from './quick-request-order-page';

type QuickRequestPageContentProps = {
  requesterName: string;
  profileDefaults: {
    full_name: string;
    phone: string | null;
  };
  /** plan 99 — 서버 `isPlaceSearchConfigured()` 결과 (기본 false) */
  placeSearchEnabled?: boolean;
};

export function QuickRequestPageContent(props: QuickRequestPageContentProps) {
  return (
    <div className='flex min-h-0 flex-1 flex-col'>
      <QuickRequestOrderPage {...props} />
    </div>
  );
}
