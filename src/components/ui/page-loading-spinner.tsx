import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

type PageLoadingSpinnerVariant = 'default' | 'fill' | 'compact' | 'overlay';

interface PageLoadingSpinnerProps extends React.ComponentProps<'div'> {
  variant?: PageLoadingSpinnerVariant;
}

const variantStyles: Record<PageLoadingSpinnerVariant, string> = {
  default: 'flex w-full min-h-[240px] items-center justify-center',
  fill: 'flex flex-1 w-full min-h-[200px] items-center justify-center',
  compact: 'flex w-full min-h-[120px] items-center justify-center',
  overlay: 'absolute inset-0 z-10 flex items-center justify-center bg-background/60'
};

function PageLoadingSpinner({
  variant = 'default',
  className,
  ...props
}: PageLoadingSpinnerProps) {
  return (
    <div className={cn(variantStyles[variant], className)} {...props}>
      <Spinner />
    </div>
  );
}

export { PageLoadingSpinner };
