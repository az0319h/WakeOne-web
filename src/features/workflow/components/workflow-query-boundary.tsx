'use client';

import * as React from 'react';
import { QueryErrorResetBoundary } from '@tanstack/react-query';
import { Icons } from '@/components/icons';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { PageLoadingSpinner } from '@/components/ui/page-loading-spinner';

export function WorkflowErrorAlert({ message, onRetry }: { message: string; onRetry: () => void }) {
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
  renderError: (error: unknown, retry: () => void) => React.ReactNode;
  children: React.ReactNode;
};

type ErrorBoundaryState = { error: unknown; hasError: boolean };

class WorkflowErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
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

type WorkflowQueryBoundaryProps = {
  /** 기본 오류 UI 문구 */
  errorMessage: string;
  /** 기본: `PageLoadingSpinner variant='compact'` */
  loadingFallback?: React.ReactNode;
  /** 오류 UI 교체 (error로 404 등 분기) */
  renderError?: (error: unknown, retry: () => void) => React.ReactNode;
  /** Suspense key — 필터가 바뀌면 다시 로딩 UI */
  suspenseKey?: string;
  children: React.ReactNode;
};

/** Suspense + 조회 오류 경계 (route error.tsx로 올라가지 않음 · AC-45) */
export function WorkflowQueryBoundary({
  errorMessage,
  loadingFallback,
  renderError,
  suspenseKey,
  children
}: WorkflowQueryBoundaryProps) {
  const loading = loadingFallback ?? <PageLoadingSpinner variant='compact' />;
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <WorkflowErrorBoundary
          key={suspenseKey}
          onReset={reset}
          renderError={(error, retry) =>
            renderError ? renderError(error, retry) : <WorkflowErrorAlert message={errorMessage} onRetry={retry} />
          }
        >
          <React.Suspense key={suspenseKey} fallback={loading}>
            {children}
          </React.Suspense>
        </WorkflowErrorBoundary>
      )}
    </QueryErrorResetBoundary>
  );
}
