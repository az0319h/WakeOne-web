import 'server-only';

import { ZipArchive } from 'archiver';
import { PassThrough, Readable } from 'node:stream';
import { getServiceRoleClient } from '@/lib/supabase/service-role';
import {
  CONTRACT_BULK_DOWNLOAD_MAX_BYTES,
  CONTRACT_BULK_DOWNLOAD_MAX_CONTRACTS,
  type ContractBulkDownloadPreview,
  type ContractBulkDownloadPreviewResponse
} from './types';

type ContractDocumentRow = {
  id: number;
  document_number: string;
  status: 'active' | 'soft_deleted';
  no_attachment_required: boolean;
};

type ContractAttachmentRow = {
  id: number;
  contract_id: number;
  file_name: string;
  storage_bucket: string;
  storage_path: string;
  file_size: number;
  status: 'active' | 'soft_deleted';
};

const CONTRACT_SELECT = `
  id,
  document_number,
  status,
  no_attachment_required
`;

const ATTACHMENT_SELECT = `
  id,
  contract_id,
  file_name,
  storage_bucket,
  storage_path,
  file_size,
  status
`;

export type BulkDownloadTarget = {
  document_number: string;
  attachments: ContractAttachmentRow[];
};

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function toKstDayStart(dateOnly: string): string {
  return new Date(`${dateOnly}T00:00:00+09:00`).toISOString();
}

function addDaysToDateString(dateOnly: string, days: number): string {
  const [year, month, day] = dateOnly.split('-').map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-${String(next.getUTCDate()).padStart(2, '0')}`;
}

function toKstNextDayStart(dateOnly: string): string {
  return toKstDayStart(addDaysToDateString(dateOnly, 1));
}

export function parseBulkDownloadDateRange(
  from: string | null | undefined,
  to: string | null | undefined
): { from: string; to: string } | { error: string } {
  const fromValue = from?.trim();
  const toValue = to?.trim();

  if (!fromValue || !toValue) {
    return { error: '문서승인일 시작일과 종료일을 모두 선택해 주세요.' };
  }

  if (!DATE_ONLY_PATTERN.test(fromValue) || !DATE_ONLY_PATTERN.test(toValue)) {
    return { error: '문서승인일 형식이 올바르지 않습니다.' };
  }

  if (fromValue > toValue) {
    return { error: '문서승인일 시작일은 종료일보다 이후일 수 없습니다.' };
  }

  return { from: fromValue, to: toValue };
}

export function buildBulkDownloadZipFileName(from: string, to: string): string {
  return `contracts-${from}_${to}.zip`;
}

export function sanitizeZipPathSegment(value: string): string {
  const sanitized = value
    .normalize('NFKC')
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim();

  return sanitized || 'unknown';
}

async function listAttachmentsByContractIds(
  contractIds: number[]
): Promise<Map<number, ContractAttachmentRow[]>> {
  if (contractIds.length === 0) {
    return new Map();
  }

  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from('contract_attachments')
    .select(ATTACHMENT_SELECT)
    .in('contract_id', contractIds)
    .eq('status', 'active')
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const byContractId = new Map<number, ContractAttachmentRow[]>();
  for (const row of (data ?? []) as unknown as ContractAttachmentRow[]) {
    const rows = byContractId.get(row.contract_id) ?? [];
    rows.push(row);
    byContractId.set(row.contract_id, rows);
  }

  return byContractId;
}

export async function listBulkDownloadTargets(from: string, to: string): Promise<BulkDownloadTarget[]> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from('contract_documents')
    .select(CONTRACT_SELECT)
    .eq('status', 'active')
    .gte('approved_at', toKstDayStart(from))
    .lt('approved_at', toKstNextDayStart(to))
    .order('approved_at', { ascending: true })
    .limit(5000);

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as unknown as ContractDocumentRow[];
  const attachmentsByContractId = await listAttachmentsByContractIds(rows.map((row) => row.id));

  const targets: BulkDownloadTarget[] = [];

  for (const row of rows) {
    if (row.no_attachment_required) {
      continue;
    }

    const attachments = attachmentsByContractId.get(row.id) ?? [];
    if (attachments.length === 0) {
      continue;
    }

    targets.push({
      document_number: row.document_number,
      attachments
    });
  }

  return targets;
}

function buildPreviewFromTargets(
  from: string,
  to: string,
  targets: BulkDownloadTarget[]
): ContractBulkDownloadPreview {
  const fileCount = targets.reduce((total, target) => total + target.attachments.length, 0);
  const totalBytes = targets.reduce(
    (total, target) => total + target.attachments.reduce((sum, attachment) => sum + attachment.file_size, 0),
    0
  );
  const contractCount = targets.length;
  const exceedsContractLimit = contractCount > CONTRACT_BULK_DOWNLOAD_MAX_CONTRACTS;
  const exceedsSizeLimit = totalBytes > CONTRACT_BULK_DOWNLOAD_MAX_BYTES;

  let blockReason: ContractBulkDownloadPreview['block_reason'] = null;
  if (contractCount === 0) {
    blockReason = 'no_targets';
  } else if (exceedsContractLimit) {
    blockReason = 'too_many_contracts';
  } else if (exceedsSizeLimit) {
    blockReason = 'too_large';
  }

  return {
    from,
    to,
    contract_count: contractCount,
    file_count: fileCount,
    total_bytes: totalBytes,
    zip_file_name: buildBulkDownloadZipFileName(from, to),
    max_contract_count: CONTRACT_BULK_DOWNLOAD_MAX_CONTRACTS,
    max_total_bytes: CONTRACT_BULK_DOWNLOAD_MAX_BYTES,
    can_download: blockReason === null,
    block_reason: blockReason
  };
}

export async function getBulkDownloadPreview(from: string, to: string): Promise<ContractBulkDownloadPreviewResponse> {
  const targets = await listBulkDownloadTargets(from, to);
  const preview = buildPreviewFromTargets(from, to, targets);

  return {
    success: true,
    message: '첨부 ZIP 다운로드 미리보기를 불러왔습니다.',
    preview
  };
}

async function downloadAttachmentBlob(row: ContractAttachmentRow): Promise<Buffer> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase.storage.from(row.storage_bucket).download(row.storage_path);

  if (error) {
    throw new Error(error.message);
  }

  return Buffer.from(await data.arrayBuffer());
}

export async function createBulkDownloadZipResponse(from: string, to: string): Promise<Response> {
  const targets = await listBulkDownloadTargets(from, to);
  const preview = buildPreviewFromTargets(from, to, targets);

  if (preview.block_reason === 'no_targets') {
    return Response.json(
      { success: false, message: '선택 기간에 첨부완료 계약이 없습니다.' },
      { status: 400 }
    );
  }

  if (preview.block_reason === 'too_many_contracts') {
    return Response.json(
      {
        success: false,
        message: `선택 기간의 첨부완료 계약이 ${CONTRACT_BULK_DOWNLOAD_MAX_CONTRACTS}건을 초과합니다. (현재 ${preview.contract_count}건) 기간을 줄여 주세요.`
      },
      { status: 400 }
    );
  }

  if (preview.block_reason === 'too_large') {
    return Response.json(
      {
        success: false,
        message: `총 용량이 ${Math.round(CONTRACT_BULK_DOWNLOAD_MAX_BYTES / 1024 / 1024)}MB를 초과합니다. 기간을 줄여 주세요.`
      },
      { status: 400 }
    );
  }

  const passThrough = new PassThrough();
  const archive = new ZipArchive({ zlib: { level: 6 } });

  archive.on('error', (error: Error) => {
    passThrough.destroy(error);
  });

  archive.pipe(passThrough);

  void (async () => {
    try {
      for (const target of targets) {
        const folderName = sanitizeZipPathSegment(target.document_number);

        for (const attachment of target.attachments) {
          const buffer = await downloadAttachmentBlob(attachment);
          const entryName = `${folderName}/${sanitizeZipPathSegment(attachment.file_name)}`;
          archive.append(buffer, { name: entryName });
        }
      }

      await archive.finalize();
    } catch (error) {
      archive.abort();
      passThrough.destroy(error instanceof Error ? error : new Error(String(error)));
    }
  })();

  const webStream = Readable.toWeb(passThrough) as ReadableStream<Uint8Array>;
  const encodedFileName = encodeURIComponent(preview.zip_file_name);
  const fallbackFileName = preview.zip_file_name.replaceAll(/[^\w.-]/g, '_');

  return new Response(webStream, {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${fallbackFileName}"; filename*=UTF-8''${encodedFileName}`
    }
  });
}
