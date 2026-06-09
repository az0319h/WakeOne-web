import { cn } from '@/lib/utils';

interface CandidateProductImageProps {
  src: string;
  alt: string;
  className?: string;
  imageClassName?: string;
  variant?: 'card' | 'inline';
}

export function CandidateProductImage({
  src,
  alt,
  className,
  imageClassName,
  variant = 'card'
}: CandidateProductImageProps) {
  if (variant === 'inline') {
    return (
      <div
        className={cn(
          'bg-background flex aspect-square w-20 shrink-0 items-center justify-center overflow-hidden rounded-md border p-2',
          className
        )}
      >
        <img
          src={src}
          alt={alt}
          className={cn('max-h-full max-w-full object-contain', imageClassName)}
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'bg-background relative aspect-square w-full overflow-hidden p-3',
        className
      )}
    >
      <img
        src={src}
        alt={alt}
        className={cn(
          'h-full w-full object-contain transition-transform duration-200 group-hover:scale-[1.02]',
          imageClassName
        )}
      />
    </div>
  );
}
