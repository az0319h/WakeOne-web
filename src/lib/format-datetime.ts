import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

const ABSOLUTE_DATETIME_PATTERN = 'yyyy-MM-dd (EEE) HH:mm:ss';

export function formatAbsoluteDateTimeKo(date: string | Date): string {
  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return typeof date === 'string' ? date : '';
  }

  return format(parsed, ABSOLUTE_DATETIME_PATTERN, { locale: ko });
}
