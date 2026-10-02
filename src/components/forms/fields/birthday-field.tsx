'use client';

import { useEffect, useMemo, useState } from 'react';
import { useStore } from '@tanstack/react-form';
import { Button } from '@/components/ui/button';
import { FieldLabel } from '@/components/ui/field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Icons } from '@/components/icons';
import { cn } from '@/lib/utils';
import {
  clampBirthdayParts,
  composeBirthdayString,
  getBirthdayDayOptions,
  getBirthdayMonthOptions,
  getBirthdayYearOptions,
  isBirthdayInRange,
  parseBirthdayParts
} from '@/lib/birthday';
import {
  useFieldContext,
  FormFieldSet,
  FormField,
  FormFieldError,
  createFormField
} from '@/components/ui/form-context';

interface BirthdayFieldProps {
  label: string;
  allowUnsetToggle?: boolean;
}

function BirthdaySelects({
  year,
  month,
  day,
  onChange,
  invalid,
  disabled
}: {
  year: string;
  month: string;
  day: string;
  onChange: (next: { year?: string; month?: string; day?: string }) => void;
  invalid?: boolean;
  disabled?: boolean;
}) {
  const yearNum = year ? Number(year) : null;
  const monthNum = month ? Number(month) : null;

  const yearOptions = useMemo(() => getBirthdayYearOptions(), []);
  const monthOptions = useMemo(() => getBirthdayMonthOptions(yearNum), [yearNum]);
  const dayOptions = useMemo(
    () => getBirthdayDayOptions(yearNum, monthNum),
    [yearNum, monthNum]
  );

  const triggerClass = 'w-full min-w-0';

  return (
    <div className='grid grid-cols-3 gap-2'>
      <Select
        value={year || undefined}
        onValueChange={(nextYear) => onChange({ year: nextYear })}
        disabled={disabled}
      >
        <SelectTrigger className={triggerClass} aria-invalid={invalid} disabled={disabled}>
          <SelectValue placeholder='년' />
        </SelectTrigger>
        <SelectContent>
          {yearOptions.map((y) => (
            <SelectItem key={y} value={String(y)}>
              {y}년
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={month || undefined}
        onValueChange={(nextMonth) => onChange({ month: nextMonth })}
        disabled={disabled || !year}
      >
        <SelectTrigger className={triggerClass} aria-invalid={invalid} disabled={disabled || !year}>
          <SelectValue placeholder='월' />
        </SelectTrigger>
        <SelectContent>
          {monthOptions.map((m) => (
            <SelectItem key={m} value={String(m)}>
              {m}월
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={day || undefined}
        onValueChange={(nextDay) => onChange({ day: nextDay })}
        disabled={disabled || !year || !month}
      >
        <SelectTrigger
          className={triggerClass}
          aria-invalid={invalid}
          disabled={disabled || !year || !month}
        >
          <SelectValue placeholder='일' />
        </SelectTrigger>
        <SelectContent>
          {dayOptions.map((d) => (
            <SelectItem key={d} value={String(d)}>
              {d}일
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function partsFromValue(value: string | null | undefined): {
  year: string;
  month: string;
  day: string;
} {
  const parts = parseBirthdayParts(value);
  if (!parts) {
    return { year: '', month: '', day: '' };
  }

  return {
    year: String(parts.year),
    month: String(parts.month),
    day: String(parts.day)
  };
}

export function BirthdayField({ label, allowUnsetToggle = false }: BirthdayFieldProps) {
  const field = useFieldContext();
  const isTouched = useStore(field.store, (s) => s.meta.isTouched);
  const isValid = useStore(field.store, (s) => s.meta.isValid);
  const value = (useStore(field.store, (s) => s.value) as string | null | undefined) ?? null;

  const [year, setYear] = useState(() => partsFromValue(value).year);
  const [month, setMonth] = useState(() => partsFromValue(value).month);
  const [day, setDay] = useState(() => partsFromValue(value).day);
  const [isUnsetMode, setIsUnsetMode] = useState(
    () => allowUnsetToggle && !value
  );

  useEffect(() => {
    const isPartialLocalEntry =
      Boolean(year || month || day) && !(year && month && day);

    if (isPartialLocalEntry) {
      return;
    }

    const next = partsFromValue(value);
    if (next.year && next.month && next.day) {
      setYear(next.year);
      setMonth(next.month);
      setDay(next.day);
      if (allowUnsetToggle) {
        setIsUnsetMode(false);
      }
      return;
    }

    if (!value) {
      if (allowUnsetToggle) {
        setIsUnsetMode(true);
      }
      setYear('');
      setMonth('');
      setDay('');
    }
  }, [value, allowUnsetToggle, year, month, day]);

  function commitParts(nextYear: string, nextMonth: string, nextDay: string) {
    if (!nextYear && !nextMonth && !nextDay) {
      field.handleChange(null);
      return;
    }

    if (!nextYear || !nextMonth || !nextDay) {
      return;
    }

    const clamped = clampBirthdayParts({
      year: Number(nextYear),
      month: Number(nextMonth),
      day: Number(nextDay)
    });
    const iso = composeBirthdayString(clamped.year, clamped.month, clamped.day);

    if (iso && isBirthdayInRange(iso)) {
      field.handleChange(iso);
      setYear(String(clamped.year));
      setMonth(String(clamped.month));
      setDay(String(clamped.day));
      return;
    }

    field.handleChange(null);
  }

  function handlePartChange(next: { year?: string; month?: string; day?: string }) {
    if (isUnsetMode) {
      return;
    }

    const nextYear = next.year ?? year;
    let nextMonth = next.month ?? month;
    let nextDay = next.day ?? day;

    if (next.year !== undefined && next.year !== year) {
      nextMonth = '';
      nextDay = '';
    } else if (next.month !== undefined && next.month !== month) {
      nextDay = '';
    }

    setYear(nextYear);
    setMonth(nextMonth);
    setDay(nextDay);
    commitParts(nextYear, nextMonth, nextDay);
  }

  function handleClear() {
    setYear('');
    setMonth('');
    setDay('');
    field.handleChange(null);
  }

  function handleUnsetToggle() {
    if (!allowUnsetToggle) {
      handleClear();
      return;
    }

    if (isUnsetMode) {
      setIsUnsetMode(false);
      return;
    }

    setIsUnsetMode(true);
    handleClear();
  }

  const hasValue = Boolean(year || month || day);
  const invalid = isTouched && !isValid;
  const showUnsetButton = allowUnsetToggle || hasValue;

  return (
    <FormFieldSet>
      <FormField>
        <div className='flex items-center justify-between gap-2'>
          <FieldLabel>{label}</FieldLabel>
          {showUnsetButton ? (
            <Button
              type='button'
              variant='ghost'
              size='sm'
              className={cn(
                'text-muted-foreground h-7 px-2 text-xs',
                allowUnsetToggle && isUnsetMode && 'text-foreground bg-muted'
              )}
              onClick={handleUnsetToggle}
              aria-pressed={allowUnsetToggle ? isUnsetMode : undefined}
            >
              <Icons.xCircle className='mr-1 h-3.5 w-3.5' />
              미설정
            </Button>
          ) : null}
        </div>
        <BirthdaySelects
          year={year}
          month={month}
          day={day}
          onChange={handlePartChange}
          invalid={invalid}
          disabled={allowUnsetToggle && isUnsetMode}
        />
      </FormField>
      <FormFieldError />
    </FormFieldSet>
  );
}

export const FormBirthdayField = createFormField(BirthdayField);
