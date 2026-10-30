import { Badge } from '@/components/ui/badge';
import { Icons } from '@/components/icons';
import { cn } from '@/lib/utils';

interface MockDataOverlayProps {
  children: React.ReactNode;
  className?: string;
  label?: string;
}

const diagonalHatchClass =
  'bg-[image:repeating-linear-gradient(315deg,var(--border)_0,var(--border)_1px,transparent_1px,transparent_50%)] bg-[size:8px_8px]';

export function MockDataOverlay({
  children,
  className,
  label = '데모'
}: MockDataOverlayProps) {
  return (
    <div
      className={cn('relative', className)}
      data-testid='mock-data-overlay'
      aria-label='템플릿 샘플 데이터'
    >
      <div className={cn('relative z-[1] h-full opacity-60 saturate-[0.85] [&>*]:h-full')}>
        {children}
      </div>
      <div
        aria-hidden
        className={cn('pointer-events-none absolute inset-0 z-[2] opacity-40', diagonalHatchClass)}
      />
      <Badge
        variant='secondary'
        // 카드 위 테두리에 걸쳐 표시 — 카드 안 추세 배지(CardAction)와 겹치지 않게
        className='absolute -top-2 right-3 z-[3] gap-1 shadow-sm select-none'
      >
        <Icons.info className='size-3' aria-hidden />
        {label}
      </Badge>
    </div>
  );
}
