'use client';

import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ActivityLog, ActivityLogMetadata } from '../../api/types';
import { getMetadataEntries, getMetadataLabel } from '../../labels';

interface ExpandPanelProps {
  log: ActivityLog;
}

function MetadataEntry({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className='grid gap-1 sm:grid-cols-[140px_1fr]'>
      <dt className='text-muted-foreground text-xs font-medium'>{label}</dt>
      <dd className='text-sm break-all'>{value}</dd>
    </div>
  );
}

function TechnicalEntry({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className='grid gap-1 sm:grid-cols-[140px_1fr]'>
      <dt className='text-muted-foreground text-xs font-medium'>{label}</dt>
      <dd className='font-mono text-xs break-all'>{value}</dd>
    </div>
  );
}

function renderMetadataValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.join(', ');
  return JSON.stringify(value, null, 2);
}

function MetadataList({ metadata }: { metadata: ActivityLogMetadata }) {
  const entries = getMetadataEntries(metadata);

  if (entries.length === 0) {
    return <p className='text-muted-foreground text-xs'>표시할 상세 정보가 없습니다.</p>;
  }

  return (
    <dl className='flex flex-col gap-2'>
      {entries.map(([key, value]) => (
        <MetadataEntry
          key={key}
          label={getMetadataLabel(key)}
          value={renderMetadataValue(value)}
        />
      ))}
    </dl>
  );
}

function TechnicalDetails({ log }: { log: ActivityLog }) {
  return (
    <dl className='flex flex-col gap-2 border-t pt-3'>
      <p className='text-muted-foreground text-xs font-medium'>기술 정보</p>
      <TechnicalEntry label='Method' value={log.http_method} />
      <TechnicalEntry label='Request ID' value={log.request_id} />
      <TechnicalEntry label='HTTP 상태' value={log.http_status} />
    </dl>
  );
}

export function ExpandPanel({ log }: ExpandPanelProps) {
  const isError = log.http_status >= 400;
  const hasMetadataContent = getMetadataEntries(log.metadata).length > 0;

  return (
    <div
      className={cn(
        'bg-muted/40 flex flex-col gap-3 rounded-md border px-4 py-3',
        isError && 'border-amber-300/60 dark:border-amber-900/60'
      )}
    >
      {isError ? (
        <>
          <div className='flex items-center gap-2'>
            <p className='text-sm font-medium'>실패 상세</p>
            <Badge variant='outline' className='text-xs'>
              {log.http_status}
            </Badge>
          </div>
          {log.metadata.message ? (
            <p className='text-sm'>{log.metadata.message}</p>
          ) : null}
          {hasMetadataContent ? (
            <MetadataList
              metadata={
                log.metadata.message
                  ? Object.fromEntries(
                      Object.entries(log.metadata).filter(([key]) => key !== 'message')
                    )
                  : log.metadata
              }
            />
          ) : null}
          <TechnicalDetails log={log} />
        </>
      ) : (
        <>
          <p className='text-sm font-medium'>상세 정보</p>
          {hasMetadataContent ? <MetadataList metadata={log.metadata} /> : null}
          <TechnicalDetails log={log} />
        </>
      )}
    </div>
  );
}

export function hasMetadata(metadata: ActivityLogMetadata): boolean {
  return Object.keys(metadata).length > 0;
}

export function isRowExpandable(log: ActivityLog): boolean {
  if (log.http_status >= 400) {
    return true;
  }

  if (log.http_status >= 200 && log.http_status < 300) {
    return hasMetadata(log.metadata);
  }

  return false;
}

export function getRowStatusHintClass(httpStatus: number): string | undefined {
  if (httpStatus >= 500) {
    return 'bg-red-500/5 hover:bg-red-500/10';
  }

  if (httpStatus >= 400) {
    return 'bg-amber-500/5 hover:bg-amber-500/10';
  }

  return undefined;
}
