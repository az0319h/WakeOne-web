import { Icons } from '@/components/icons';
import { cn } from '@/lib/utils';

type AssetLedgerEmptyProps = {
  icon: keyof typeof Icons;
  title: string;
  description?: string | null;
  action?: React.ReactNode;
  className?: string;
  'data-testid'?: string;
};

/** 표·카드 자리 빈 상태 (quick 대시보드 빈 상태와 같은 모양) */
export function AssetLedgerEmpty({
  icon,
  title,
  description,
  action,
  className,
  ...rest
}: AssetLedgerEmptyProps) {
  const IconComponent = Icons[icon];
  return (
    <div
      data-testid={rest['data-testid']}
      className={cn(
        'flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-4 py-12 text-center',
        className
      )}
    >
      <IconComponent aria-hidden className='size-10 text-muted-foreground' />
      <p className='text-base font-medium text-foreground'>{title}</p>
      {description ? <p className='text-sm text-muted-foreground'>{description}</p> : null}
      {action}
    </div>
  );
}
