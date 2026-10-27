'use client';

import { QuickRequestOrderPage } from './quick-request-order-page';

type QuickRequestPageContentProps = {
  requesterName: string;
  profileDefaults: {
    full_name: string;
    phone: string | null;
  };
};

export function QuickRequestPageContent(props: QuickRequestPageContentProps) {
  return (
    <div className='flex min-h-0 flex-1 flex-col'>
      <QuickRequestOrderPage {...props} />
    </div>
  );
}
