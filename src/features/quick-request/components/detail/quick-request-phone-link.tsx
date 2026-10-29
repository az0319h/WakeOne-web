import { formatPhoneDisplay } from '@/lib/phone';

type QuickRequestPhoneLinkProps = {
  phone: string | null | undefined;
  'data-testid'?: string;
};

/** 연락처 `tel:` 링크 (표시는 `010-1234-5678`) · 없으면 「—」 · 모바일 터치 타깃 44px, md↑ 행 높이 불변 (plan 94 U-4) */
export function QuickRequestPhoneLink({ phone, 'data-testid': testId }: QuickRequestPhoneLinkProps) {
  if (!phone) {
    return <span data-testid={testId}>—</span>;
  }
  return (
    <a
      href={`tel:${phone}`}
      data-testid={testId}
      className='inline-flex min-h-11 items-center text-primary tabular-nums underline-offset-4 hover:underline md:min-h-0'
    >
      {formatPhoneDisplay(phone) ?? phone}
    </a>
  );
}
