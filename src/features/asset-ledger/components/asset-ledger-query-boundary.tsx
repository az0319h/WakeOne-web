'use client';

import * as React from 'react';
import { QueryErrorResetBoundary } from '@tanstack/react-query';
import { Icons } from '@/components/icons';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { PageLoadingSpinner } from '@/components/ui/page-loading-spinner';

type ErrorBoundaryProps = {
  onReset: () => void;
  renderError: (error: unknown, retry: () => void) => React.ReactNode;
  children: React.ReactNode;
};

type ErrorBoundaryState = { error: unknown; hasError: boolean };

/** `useSuspenseQuery` 실패를 섹션 안에서 막는다 (route `error.tsx`로 올라가지 않음) */
class AssetLedgerErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null, hasError: false };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { error, hasError: true };
  }

  private handleRetry = () => {
    this.props.onReset();
    this.setState({ error: null, hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return this.props.renderError(this.state.error, this.handleRetry);
    }
    return this.props.children;
  }
}

type AssetLedgerErrorAlertProps = {
  message: string;
  onRetry: () => void;
};

/** 조회 실패 안내 + 「다시 시도」 */
export function AssetLedgerErrorAlert({ message, onRetry }: AssetLedgerErrorAlertProps) {
  return (
    <Alert variant='destructive'>
      <Icons.alertCircle aria-hidden />
      <AlertDescription className='flex flex-col items-start gap-3'>
        <span>{message}</span>
        <Button type='button' variant='outline' className='h-11 md:h-9' onClick={onRetry}>
          다시 시도
        </Button>
      </AlertDescription>
    </Alert>
  );
}

type AssetLedgerQueryBoundaryProps = {
  errorMessage: string;
  /** 기본 `PageLoadingSpinner variant='fill'` */
  loadingFallback?: React.ReactNode;
  /** 오류 UI 교체 (기본: 안내 + 다시 시도) */
  renderError?: (error: unknown, retry: () => void) => React.ReactNode;
  /** 바뀌면 Suspense를 새로 건다 — 필터 서명 */
  resetKey?: string;
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

/**
 * Suspense + 조회 오류 경계 (quick-request-query-boundary 구조 복제).
 * 서버 prefetch를 하지 않으므로 SSR·hydration 동안은 로딩 UI만 그리고, hydration 뒤 클라이언트에서 조회한다
 * (서버에서 상대 URL fetch → 「Switched to client rendering」 오류를 막음 · quick `ssrQueryKey` 방식과 같은 이유).
 */
export function AssetLedgerQueryBoundary({
  errorMessage,
  loadingFallback,
  renderError,
  resetKey,
  children
}: AssetLedgerQueryBoundaryProps) {
  const isHydrated = useIsHydrated();
  const loading = loadingFallback ?? <PageLoadingSpinner variant='fill' />;
  if (!isHydrated) {
    return loading;
  }
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <AssetLedgerErrorBoundary
          key={resetKey}
          onReset={reset}
          renderError={(error, retry) =>
            renderError ? (
              renderError(error, retry)
            ) : (
              <AssetLedgerErrorAlert message={errorMessage} onRetry={retry} />
            )
          }
        >
          <React.Suspense key={resetKey} fallback={loading}>
            {children}
          </React.Suspense>
        </AssetLedgerErrorBoundary>
      )}
    </QueryErrorResetBoundary>
  );
}

/** 404 계열 서버 문구인지 (단건 Dialog — 「찾을 수 없어요」 상자) */
export function isNotFoundError(error: unknown): boolean {
  return error instanceof Error && /찾을 수 없/.test(error.message);
}
