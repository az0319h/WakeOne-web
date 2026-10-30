import { Icons } from '@/components/icons';
import { formatPhoneDisplay } from '@/lib/phone';

type QuickRequestPhoneLinkProps = {
  phone: string | null | undefined;
  'data-testid'?: string;
};

/**
 * 연락처 `tel:` 링크 (표시는 `010-1234-5678`) · 없으면 「—」 (plan 94 U-4).
 *
 * plan 106 (lg 미만 · 휴대폰·태블릿 규칙):
 * - 터치 영역 44px를 **lg 미만 전체**(md~lg 태블릿 포함)에서 유지한다.
 * - 전화 아이콘 + 옅은 알약 배경으로 「누르면 전화가 걸린다」를 보이게 한다.
 * - 44px 상자는 위아래 음수 여백(`-my-2.5`)으로 줄 높이를 24px로 맞춰 왼쪽 라벨(「연락처」 등)과 줄이 맞는다.
 * lg 이상(PC)은 지금 화면 그대로 — 아이콘은 `lg:hidden`, 알약 모양은 전부 `max-lg:`.
 * 접근 이름은 번호만(아이콘 `aria-hidden`).
 */
export function QuickRequestPhoneLink({ phone, 'data-testid': testId }: QuickRequestPhoneLinkProps) {
  if (!phone) {
    return <span data-testid={testId}>—</span>;
  }
  return (
    <a
      href={`tel:${phone}`}
      data-testid={testId}
      className='inline-flex min-h-11 items-center text-primary tabular-nums underline-offset-4 hover:underline max-lg:-my-2.5 max-lg:touch-manipulation lg:min-h-0'
    >
      <span className='max-lg:inline-flex max-lg:items-center max-lg:gap-1.5 max-lg:rounded-full max-lg:bg-primary/10 max-lg:px-2.5 max-lg:py-0.5 max-lg:font-medium'>
        <Icons.phone aria-hidden className='size-3.5 shrink-0 lg:hidden' />
        {formatPhoneDisplay(phone) ?? phone}
      </span>
    </a>
  );
}
