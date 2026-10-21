'use client';

import * as React from 'react';
import { QueryErrorResetBoundary, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { PageLoadingSpinner } from '@/components/ui/page-loading-spinner';
import { Icons } from '@/components/icons';

type QuickRequestQueryErrorAlertProps = {
  message: string;
  onRetry: () => void;
};

/** 조회 실패 안내 + 「다시 시도」 */
export function QuickRequestQueryErrorAlert({ message, onRetry }: QuickRequestQueryErrorAlertProps) {
  return (
    <Alert variant='destructive'>
      <Icons.alertCircle aria-hidden />
      <AlertDescription className='flex flex-col items-start gap-3'>
        <span>{message}</span>
        <Button type='button' variant='outline' className='h-11' onClick={onRetry}>
          다시 시도
        </Button>
      </AlertDescription>
    </Alert>
  );
}

type ErrorBoundaryProps = {
  onReset: () => void;
  renderError: (retry: () => void) => React.ReactNode;
  children: React.ReactNode;
};

type ErrorBoundaryState = { hasError: boolean };

/** `useSuspenseQuery` 실패를 섹션 안에서 막는다 (route `error.tsx`로 올라가지 않음) */
class QuickRequestErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  private handleRetry = () => {
    this.props.onReset();
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return this.props.renderError(this.handleRetry);
    }
    return this.props.children;
  }
}

type QuickRequestQueryBoundaryProps = {
  /** 조회 실패 시 안내 문구 (기본 오류 UI) */
  errorMessage: string;
  /** 로딩 UI 교체 (기본: `PageLoadingSpinner variant='compact'`) */
  loadingFallback?: React.ReactNode;
  /** 오류 UI 교체 — `alert`는 기본 안내 + 다시 시도 */
  renderError?: (alert: React.ReactNode) => React.ReactNode;
  /**
   * 서버 prefetch 대상 key. 캐시에 데이터가 없으면(prefetch 실패) SSR·hydration 동안
   * children 대신 로딩 UI를 그리고, hydration 뒤 클라이언트에서 조회한다
   * (서버에서 상대 URL fetch → SSR 오류를 막음).
   */
  ssrQueryKey?: QueryKey;
  children: React.ReactNode;
};

const subscribeNoop = () => () => undefined;

/** SSR·hydration 중 false, hydration 이후 true */
function useIsHydrated() {
  return React.useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false
  );
}

/** Suspense + 조회 오류 경계 — 칩 목록 · 최근 이용 내역 공용 */
export function QuickRequestQueryBoundary({
  errorMessage,
  loadingFallback,
  renderError,
  ssrQueryKey,
  children
}: QuickRequestQueryBoundaryProps) {
  const queryClient = useQueryClient();
  const isHydrated = useIsHydrated();
  const loading = loadingFallback ?? <PageLoadingSpinner variant='compact' />;

  if (ssrQueryKey && !isHydrated && queryClient.getQueryData(ssrQueryKey) === undefined) {
    return loading;
  }

  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <QuickRequestErrorBoundary
          onReset={reset}
          renderError={(retry) => {
            const alert = <QuickRequestQueryErrorAlert message={errorMessage} onRetry={retry} />;
            return renderError ? renderError(alert) : alert;
          }}
        >
          <React.Suspense fallback={loading}>
            {children}
          </React.Suspense>
        </QuickRequestErrorBoundary>
      )}
    </QueryErrorResetBoundary>
  );
}
