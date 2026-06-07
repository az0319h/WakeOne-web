'use client';

import type { ReactNode } from 'react';
import type { ActivityLog, ActivityLogMetadata } from '../../api/types';

interface ExpandPanelProps {
  log: ActivityLog;
}

function MetadataEntry({ label, value }: { label: string; value: ReactNode }) {
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
  const entries = Object.entries(metadata).filter(([, value]) => value !== undefined);

  if (entries.length === 0) {
    return <p className='text-muted-foreground text-xs'>표시할 metadata가 없습니다.</p>;
  }

  return (
    <dl className='flex flex-col gap-2'>
      {entries.map(([key, value]) => (
        <MetadataEntry key={key} label={key} value={renderMetadataValue(value)} />
      ))}
    </dl>
  );
}

export function ExpandPanel({ log }: ExpandPanelProps) {
  const isError = log.http_status >= 400;

  return (
    <div className='bg-muted/40 flex flex-col gap-3 rounded-md border px-4 py-3'>
      {isError ? (
        <>
          <p className='text-sm font-medium'>실패 상세</p>
          <dl className='flex flex-col gap-2'>
            {log.metadata.error_code ? (
              <MetadataEntry label='error_code' value={log.metadata.error_code} />
            ) : null}
            {log.metadata.message ? (
              <MetadataEntry label='message' value={log.metadata.message} />
            ) : null}
            {log.metadata.validation_errors ? (
              <MetadataEntry
                label='validation_errors'
                value={renderMetadataValue(log.metadata.validation_errors)}
              />
            ) : null}
            <MetadataEntry label='request_id' value={log.request_id} />
          </dl>
        </>
      ) : (
        <>
          <p className='text-sm font-medium'>metadata</p>
          <MetadataList metadata={log.metadata} />
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
