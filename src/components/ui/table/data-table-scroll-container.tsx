import type * as React from 'react';

import { cn } from '@/lib/utils';

type DataTableScrollContainerProps = React.ComponentProps<'div'>;

/**
 * Horizontal scroll lives on shadcn `[data-slot=table-container]` (extend via selector).
 * Outer wrapper bounds width; inner table uses w-max so overflow triggers scroll.
 */
export function DataTableScrollContainer({
  className,
  children,
  ...props
}: DataTableScrollContainerProps) {
  return (
    <div
      className={cn(
        'min-w-0 w-full max-w-full rounded-lg border',
        '[&_[data-slot=table-container]]:w-full',
        '[&_[data-slot=table-container]]:max-w-full',
        '[&_[data-slot=table-container]]:overflow-x-auto',
        '[&_[data-slot=table]]:w-max',
        '[&_[data-slot=table]]:min-w-full',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
