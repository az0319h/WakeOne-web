'use client';

import { Component, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { getQueryClient } from '@/lib/query-client';
import { officeSnackKeys } from '../api/queries';

interface OfficeSnacksListingErrorBoundaryProps {
  children: ReactNode;
}

interface OfficeSnacksListingErrorBoundaryState {
  hasError: boolean;
}

export class OfficeSnacksListingErrorBoundary extends Component<
  OfficeSnacksListingErrorBoundaryProps,
  OfficeSnacksListingErrorBoundaryState
> {
  state: OfficeSnacksListingErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): OfficeSnacksListingErrorBoundaryState {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className='flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-6 py-12 text-center'>
          <p className='text-sm font-medium'>목록을 불러오지 못했습니다.</p>
          <p className='text-muted-foreground text-sm'>네트워크 상태를 확인한 뒤 다시 시도해 주세요.</p>
          <Button
            type='button'
            variant='outline'
            onClick={() => {
              this.setState({ hasError: false });
              void getQueryClient().invalidateQueries({ queryKey: officeSnackKeys.sessions() });
            }}
          >
            다시 시도
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
