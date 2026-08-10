import { Badge } from '@/components/ui/badge';

interface AnnouncementPinBadgeProps {
  className?: string;
}

export function AnnouncementPinBadge({ className }: AnnouncementPinBadgeProps) {
  return (
    <Badge variant='secondary' className={className}>
      고정
    </Badge>
  );
}
