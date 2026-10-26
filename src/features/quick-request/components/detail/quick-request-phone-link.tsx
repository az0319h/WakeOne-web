import { formatPhoneDisplay } from '@/lib/phone';

type QuickRequestPhoneLinkProps = {
  phone: string | null | undefined;
  'data-testid'?: string;
};

/** 연락처 `tel:` 링크 (표시는 `010-1234-5678`) · 없으면 「—」 */
export function QuickRequestPhoneLink({ phone, 'data-testid': testId }: QuickRequestPhoneLinkProps) {
  if (!phone) {
    return <span data-testid={testId}>—</span>;
  }
  return (
    <a
      href={`tel:${phone}`}
      data-testid={testId}
      className='text-primary tabular-nums underline-offset-4 hover:underline'
    >
      {formatPhoneDisplay(phone) ?? phone}
    </a>
  );
}
