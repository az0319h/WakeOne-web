'use client';

import * as React from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { PageLoadingSpinner } from '@/components/ui/page-loading-spinner';
import { Icons } from '@/components/icons';

type DaumPostcodeData = {
  address: string;
  roadAddress: string;
  jibunAddress: string;
};

type DaumPostcodeSize = { width: number; height: number };

type DaumPostcodeInstance = {
  embed: (element: HTMLElement, options?: { autoClose?: boolean }) => void;
};

declare global {
  interface Window {
    daum?: {
      Postcode: new (options: {
        oncomplete: (data: DaumPostcodeData) => void;
        onresize?: (size: DaumPostcodeSize) => void;
        onclose?: (state: string) => void;
        width?: string | number;
        height?: string | number;
        /** 검색창 자동 포커스 (기본 true) */
        focusInput?: boolean;
      }) => DaumPostcodeInstance;
    };
  }
}

const DAUM_POSTCODE_SCRIPT = 'https://t1.kakaocdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';
const MIN_EMBED_HEIGHT = 400;

let scriptPromise: Promise<void> | null = null;

function loadDaumPostcodeScript(): Promise<void> {
  if (window.daum?.Postcode) {
    return Promise.resolve();
  }
  if (scriptPromise) {
    return scriptPromise;
  }
  scriptPromise = new Promise<void>((resolve, reject) => {
    document.querySelector(`script[src="${DAUM_POSTCODE_SCRIPT}"]`)?.remove();
    const script = document.createElement('script');
    script.src = DAUM_POSTCODE_SCRIPT;
    script.async = true;
    script.onload = () => (window.daum?.Postcode ? resolve() : reject(new Error('unavailable')));
    script.onerror = () => reject(new Error('script load failed'));
    document.body.appendChild(script);
  }).catch((error: unknown) => {
    // 다음 「다시 시도」에서 새로 로드
    scriptPromise = null;
    throw error;
  });
  return scriptPromise;
}

/** 컨테이너 폭이 0보다 커진 뒤 실행 (Dialog 열림 직후 0 크기 대비) */
function whenSized(element: HTMLElement, run: () => void): () => void {
  if (element.clientWidth > 0) {
    run();
    return () => undefined;
  }
  const observer = new ResizeObserver(() => {
    if (element.clientWidth > 0) {
      observer.disconnect();
      run();
    }
  });
  observer.observe(element);
  return () => observer.disconnect();
}

type QuickRequestDaumPostcodeEmbedProps = {
  /** 도로명(없으면 기본 주소) */
  onComplete: (roadAddress: string) => void;
};

type EmbedStatus = 'loading' | 'ready' | 'error';

/** Daum 우편번호 embed — popup 없이 Dialog 안에 렌더 (plan 87) */
export function QuickRequestDaumPostcodeEmbed({ onComplete }: QuickRequestDaumPostcodeEmbedProps) {
  const [status, setStatus] = React.useState<EmbedStatus>('loading');
  const [height, setHeight] = React.useState(MIN_EMBED_HEIGHT);
  const [attempt, setAttempt] = React.useState(0);
  const onCompleteRef = React.useRef(onComplete);

  React.useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const embedRef = React.useCallback(
    (element: HTMLDivElement | null) => {
      if (!element) {
        return undefined;
      }
      let cancelled = false;
      let stopWaiting: () => void = () => undefined;

      loadDaumPostcodeScript()
        .then(() => {
          if (cancelled) return;
          stopWaiting = whenSized(element, () => {
            if (cancelled || !window.daum?.Postcode) return;
            new window.daum.Postcode({
              oncomplete: (data) => onCompleteRef.current(data.roadAddress || data.address),
              onresize: (size) => setHeight(Math.max(MIN_EMBED_HEIGHT, size.height)),
              width: '100%',
              height: '100%',
              // iframe이 포커스를 가져가면 Esc가 Dialog에 닿지 않는다 — 열림 포커스는 Dialog가 관리
              focusInput: false
            }).embed(element, { autoClose: false });
            setStatus('ready');
          });
        })
        .catch(() => {
          if (!cancelled) setStatus('error');
        });

      return () => {
        cancelled = true;
        stopWaiting();
        element.replaceChildren();
      };
    },
    []
  );

  function handleRetry() {
    setStatus('loading');
    setAttempt((n) => n + 1);
  }

  if (status === 'error') {
    return (
      <Alert variant='destructive' data-testid='quick-request-address-picker-postcode'>
        <Icons.alertCircle aria-hidden />
        <AlertDescription className='flex flex-col items-start gap-3'>
          <span>주소 검색을 불러오지 못했습니다. 다시 시도하거나 주소를 직접 입력해 주세요.</span>
          <Button type='button' variant='outline' className='h-11' onClick={handleRetry}>
            다시 시도
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div
      data-testid='quick-request-address-picker-postcode'
      className='relative w-full min-h-100 overflow-hidden rounded-md border'
      style={{ height }}
    >
      {/* key: 「다시 시도」 시 새 노드로 다시 embed */}
      <div key={attempt} ref={embedRef} className='size-full' />
      {status === 'loading' ? (
        <PageLoadingSpinner variant='compact' className='absolute inset-0 min-h-0' />
      ) : null}
    </div>
  );
}
