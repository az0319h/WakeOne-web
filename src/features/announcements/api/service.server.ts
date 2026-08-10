import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { getServiceRoleClient } from '@/lib/supabase/service-role';
import { insertAnnouncementPublishedNotifications } from '@/features/notifications/api/fan-out.server';
import {
  ANNOUNCEMENT_ATTACHMENT_BUCKET,
  ANNOUNCEMENT_ATTACHMENT_PER_FILE_MAX_BYTES,
  ANNOUNCEMENT_ATTACHMENT_PER_FILE_SIZE_ERROR,
  ANNOUNCEMENT_ATTACHMENT_TOTAL_MAX_BYTES,
  ANNOUNCEMENT_ATTACHMENT_TOTAL_SIZE_ERROR,
  ANNOUNCEMENTS_OVERVIEW_LIMIT,
  ANNOUNCEMENTS_PAGE_SIZE,
  ANNOUNCEMENTS_PIN_MAX,
  ANNOUNCEMENTS_PIN_MAX_ERROR,
  type Announcement,
  type AnnouncementAttachmentSummary,
  type AnnouncementCreatePayload,
  type AnnouncementListItem,
  type AnnouncementsFilters,
  type AnnouncementsListResponse,
  type AnnouncementUpdatePayload
} from './types';

const SAFE_EXTENSION_PATTERN = /^[a-z0-9]+$/;
const MAX_SAFE_EXTENSION_LENGTH = 16;

type AnnouncementRow = {
  id: number;
  title: string;
  body: string;
  priority: Announcement['priority'];
  is_pinned: boolean;
  created_by: string;
  notified_at: string | null;
  created_at: string;
  updated_at: string;
};

type AnnouncementAttachmentRow = {
  id: number;
  announcement_id: number;
  file_name: string;
  file_size: number;
  content_type: string | null;
  storage_path: string;
  uploaded_by: string;
  created_at: string;
};

export type AnnouncementCursor = {
  is_pinned: boolean;
  created_at: string;
  id: number;
};

const ANNOUNCEMENT_SELECT = `
  id,
  title,
  body,
  priority,
  is_pinned,
  created_by,
  notified_at,
  created_at,
  updated_at
`;

const ATTACHMENT_SELECT = `
  id,
  announcement_id,
  file_name,
  file_size,
  content_type,
  storage_path,
  uploaded_by,
  created_at
`;

const DEFAULT_LIMIT = ANNOUNCEMENTS_PAGE_SIZE;
const MAX_LIMIT = 50;

function mapAnnouncementRow(row: AnnouncementRow): Announcement {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    priority: row.priority,
    is_pinned: row.is_pinned,
    created_by: row.created_by,
    notified_at: row.notified_at,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function mapListItem(row: AnnouncementRow): AnnouncementListItem {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    priority: row.priority,
    is_pinned: row.is_pinned,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function mapAttachment(row: AnnouncementAttachmentRow): AnnouncementAttachmentSummary {
  return {
    id: row.id,
    file_name: row.file_name,
    content_type: row.content_type,
    file_size: row.file_size,
    created_at: row.created_at
  };
}

export function encodeAnnouncementCursor(cursor: AnnouncementCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString('base64url');
}

export function decodeAnnouncementCursor(cursor: string): AnnouncementCursor | null {
  try {
    const parsed = JSON.parse(
      Buffer.from(cursor, 'base64url').toString('utf8')
    ) as Partial<AnnouncementCursor>;

    if (
      typeof parsed.is_pinned === 'boolean' &&
      typeof parsed.created_at === 'string' &&
      typeof parsed.id === 'number'
    ) {
      return {
        is_pinned: parsed.is_pinned,
        created_at: parsed.created_at,
        id: parsed.id
      };
    }

    return null;
  } catch {
    return null;
  }
}

function applyAnnouncementListFilters<
  T extends {
    eq: (column: string, value: boolean) => T;
    in: (column: string, values: string[]) => T;
    or: (filters: string) => T;
  }
>(query: T, filters: Pick<AnnouncementsFilters, 'search' | 'priority' | 'pinned'>): T {
  let next = query;

  if (filters.pinned === true) {
    next = next.eq('is_pinned', true);
  }

  if (filters.priority && filters.priority.length > 0) {
    next = next.in('priority', filters.priority);
  }

  if (filters.search?.trim()) {
    const escaped = filters.search.trim().replaceAll(',', ' ');
    next = next.or(`title.ilike.%${escaped}%,body.ilike.%${escaped}%`);
  }

  return next;
}

function applyAnnouncementCursor<T extends { or: (filter: string) => T; eq: (col: string, val: boolean) => T }>(
  query: T,
  cursor: AnnouncementCursor
): T {
  if (cursor.is_pinned) {
    return query.or(
      `is_pinned.eq.false,and(is_pinned.eq.true,created_at.lt.${cursor.created_at}),and(is_pinned.eq.true,created_at.eq.${cursor.created_at},id.lt.${cursor.id})`
    );
  }

  return query
    .eq('is_pinned', false)
    .or(
      `created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`
    );
}

async function listAttachmentsByAnnouncementIds(
  announcementIds: number[]
): Promise<Map<number, AnnouncementAttachmentSummary[]>> {
  const map = new Map<number, AnnouncementAttachmentSummary[]>();
  if (announcementIds.length === 0) {
    return map;
  }

  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from('announcement_attachments')
    .select(ATTACHMENT_SELECT)
    .in('announcement_id', announcementIds)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  for (const row of data ?? []) {
    const attachmentRow = row as AnnouncementAttachmentRow;
    const attachment = mapAttachment(attachmentRow);
    const list = map.get(attachmentRow.announcement_id) ?? [];
    list.push(attachment);
    map.set(attachmentRow.announcement_id, list);
  }

  return map;
}

function validateTitle(title: string): string | null {
  const trimmed = title.trim();
  if (trimmed.length < 1 || trimmed.length > 120) {
    return '제목은 1~120자여야 합니다.';
  }
  return null;
}

function validateBody(body: string): string | null {
  const trimmed = body.trim();
  if (trimmed.length < 1 || trimmed.length > 5000) {
    return '본문은 1~5000자여야 합니다.';
  }
  return null;
}

async function countPinnedAnnouncements(excludeId?: number): Promise<number> {
  const supabase = getServiceRoleClient();
  let query = supabase
    .from('announcements')
    .select('id', { count: 'exact', head: true })
    .eq('is_pinned', true);

  if (excludeId !== undefined) {
    query = query.neq('id', excludeId);
  }

  const { count, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  return count ?? 0;
}

export async function validatePinLimit(isPinned: boolean, excludeId?: number): Promise<string | null> {
  if (!isPinned) {
    return null;
  }

  const pinnedCount = await countPinnedAnnouncements(excludeId);
  if (pinnedCount >= ANNOUNCEMENTS_PIN_MAX) {
    return ANNOUNCEMENTS_PIN_MAX_ERROR;
  }

  return null;
}

async function fanOutAndMarkNotified(announcementId: number, title: string): Promise<void> {
  await insertAnnouncementPublishedNotifications({ announcementId, title });

  const supabase = getServiceRoleClient();
  const { error } = await supabase
    .from('announcements')
    .update({ notified_at: new Date().toISOString() })
    .eq('id', announcementId)
    .is('notified_at', null);

  if (error) {
    throw new Error(error.message);
  }
}

export async function listAnnouncements(
  filters: AnnouncementsFilters = {}
): Promise<AnnouncementsListResponse> {
  const limit = Math.min(Math.max(filters.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
  const supabase = await createClient();

  let query = supabase
    .from('announcements')
    .select(ANNOUNCEMENT_SELECT)
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit + 1);

  query = applyAnnouncementListFilters(query, filters);

  if (filters.cursor) {
    const decoded = decodeAnnouncementCursor(filters.cursor);
    if (decoded) {
      query = applyAnnouncementCursor(query, decoded);
    }
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as AnnouncementRow[];
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page.at(-1);

  return {
    announcements: page.map(mapListItem),
    nextCursor:
      hasMore && last
        ? encodeAnnouncementCursor({
            is_pinned: last.is_pinned,
            created_at: last.created_at,
            id: last.id
          })
        : null,
    hasMore
  };
}

export async function listAnnouncementsOverview(): Promise<AnnouncementListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('announcements')
    .select(ANNOUNCEMENT_SELECT)
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(ANNOUNCEMENTS_OVERVIEW_LIMIT);

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as AnnouncementRow[]).map(mapListItem);
}

export async function getAnnouncementById(id: number): Promise<Announcement | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('announcements')
    .select(ANNOUNCEMENT_SELECT)
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  const announcement = mapAnnouncementRow(data as AnnouncementRow);
  const attachmentsById = await listAttachmentsByAnnouncementIds([id]);
  return {
    ...announcement,
    attachments: attachmentsById.get(id) ?? []
  };
}

export async function createAnnouncement(input: {
  payload: AnnouncementCreatePayload;
  actorUserId: string;
}): Promise<{ announcement: Announcement; fanOutCompleted: boolean }> {
  const titleError = validateTitle(input.payload.title);
  if (titleError) {
    throw new Error(titleError);
  }

  const bodyError = validateBody(input.payload.body);
  if (bodyError) {
    throw new Error(bodyError);
  }

  const isPinned = input.payload.is_pinned ?? false;
  const pinError = await validatePinLimit(isPinned);
  if (pinError) {
    throw new Error(pinError);
  }

  const priority = input.payload.priority ?? 'normal';
  const supabase = getServiceRoleClient();

  const { data, error } = await supabase
    .from('announcements')
    .insert({
      title: input.payload.title.trim(),
      body: input.payload.body.trim(),
      priority,
      is_pinned: isPinned,
      created_by: input.actorUserId
    })
    .select(ANNOUNCEMENT_SELECT)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const announcement = mapAnnouncementRow(data as AnnouncementRow);
  let fanOutCompleted = false;

  if (!input.payload.defer_notify) {
    try {
      await fanOutAndMarkNotified(announcement.id, announcement.title);
      fanOutCompleted = true;
      announcement.notified_at = new Date().toISOString();
    } catch (fanOutError) {
      console.error('[announcements] create fan-out failed:', fanOutError);
    }
  }

  return { announcement: { ...announcement, attachments: [] }, fanOutCompleted };
}

export async function updateAnnouncement(input: {
  id: number;
  payload: AnnouncementUpdatePayload;
}): Promise<Announcement | null> {
  const existing = await getAnnouncementById(input.id);
  if (!existing) {
    return null;
  }

  const updates: Record<string, unknown> = {};

  if (input.payload.title !== undefined) {
    const titleError = validateTitle(input.payload.title);
    if (titleError) {
      throw new Error(titleError);
    }
    updates.title = input.payload.title.trim();
  }

  if (input.payload.body !== undefined) {
    const bodyError = validateBody(input.payload.body);
    if (bodyError) {
      throw new Error(bodyError);
    }
    updates.body = input.payload.body.trim();
  }

  if (input.payload.priority !== undefined) {
    updates.priority = input.payload.priority;
  }

  if (input.payload.is_pinned !== undefined) {
    const pinError = await validatePinLimit(input.payload.is_pinned, input.id);
    if (pinError) {
      throw new Error(pinError);
    }
    updates.is_pinned = input.payload.is_pinned;
  }

  if (Object.keys(updates).length === 0) {
    return existing;
  }

  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from('announcements')
    .update(updates)
    .eq('id', input.id)
    .select(ANNOUNCEMENT_SELECT)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  return {
    ...mapAnnouncementRow(data as AnnouncementRow),
    attachments: existing.attachments ?? []
  };
}

export async function deleteAnnouncement(id: number): Promise<boolean> {
  const supabase = getServiceRoleClient();

  const { data: attachments, error: attachmentError } = await supabase
    .from('announcement_attachments')
    .select('storage_path')
    .eq('announcement_id', id);

  if (attachmentError) {
    throw new Error(attachmentError.message);
  }

  const storagePaths = (attachments ?? []).map(
    (row) => (row as { storage_path: string }).storage_path
  );

  if (storagePaths.length > 0) {
    const { error: storageError } = await supabase.storage
      .from(ANNOUNCEMENT_ATTACHMENT_BUCKET)
      .remove(storagePaths);

    if (storageError) {
      throw new Error(storageError.message);
    }
  }

  const { data, error } = await supabase
    .from('announcements')
    .delete()
    .eq('id', id)
    .select('id')
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return Boolean(data);
}

export async function notifyAnnouncementPublished(id: number): Promise<{
  notified: boolean;
  announcement: Announcement | null;
}> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from('announcements')
    .select(ANNOUNCEMENT_SELECT)
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return { notified: false, announcement: null };
  }

  const row = data as AnnouncementRow;

  if (row.notified_at) {
    const announcement = await getAnnouncementById(id);
    return { notified: false, announcement };
  }

  try {
    await fanOutAndMarkNotified(id, row.title);
  } catch (fanOutError) {
    console.error('[announcements] notify fan-out failed:', fanOutError);
  }

  const announcement = await getAnnouncementById(id);
  return { notified: true, announcement };
}

function getSafeFileExtension(fileName: string): string {
  const pathSafeName = Array.from(fileName.normalize('NFKC'))
    .filter((char) => {
      const code = char.charCodeAt(0);
      return code > 31 && code !== 127;
    })
    .join('');
  const baseName = pathSafeName.split(/[\\/]/).pop()?.trim() ?? '';
  const dotIndex = baseName.lastIndexOf('.');

  if (dotIndex <= 0 || dotIndex === baseName.length - 1) {
    return '';
  }

  const extension = baseName.slice(dotIndex + 1).toLowerCase();
  if (extension.length > MAX_SAFE_EXTENSION_LENGTH || !SAFE_EXTENSION_PATTERN.test(extension)) {
    return '';
  }

  return `.${extension}`;
}

function buildAttachmentStoragePath(announcementId: number, fileName: string): string {
  // storage_path에는 원본 file_name을 넣지 않음 — Supabase key invalid 방지 (contracts 패턴)
  return `${announcementId}/${crypto.randomUUID()}${getSafeFileExtension(fileName)}`;
}

async function getAttachmentTotalSize(announcementId: number): Promise<number> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from('announcement_attachments')
    .select('file_size')
    .eq('announcement_id', announcementId);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).reduce((sum, row) => sum + ((row as { file_size: number }).file_size ?? 0), 0);
}

export async function uploadAnnouncementAttachment(input: {
  announcementId: number;
  file: File;
  actorUserId: string;
}): Promise<{ announcement: Announcement; attachment: AnnouncementAttachmentSummary } | null> {
  const announcement = await getAnnouncementById(input.announcementId);
  if (!announcement) {
    return null;
  }

  const fileName = input.file.name.trim();
  if (!fileName) {
    throw new Error('파일명이 올바르지 않습니다.');
  }

  if (announcement.attachments?.some((attachment) => attachment.file_name === fileName)) {
    throw new Error('같은 공지에 동일한 파일명을 다시 업로드할 수 없습니다.');
  }

  if (input.file.size > ANNOUNCEMENT_ATTACHMENT_PER_FILE_MAX_BYTES) {
    throw new Error(ANNOUNCEMENT_ATTACHMENT_PER_FILE_SIZE_ERROR);
  }

  const currentTotal = await getAttachmentTotalSize(input.announcementId);
  if (currentTotal + input.file.size > ANNOUNCEMENT_ATTACHMENT_TOTAL_MAX_BYTES) {
    throw new Error(ANNOUNCEMENT_ATTACHMENT_TOTAL_SIZE_ERROR);
  }

  const storagePath = buildAttachmentStoragePath(input.announcementId, fileName);
  const supabase = getServiceRoleClient();

  const { error: uploadError } = await supabase.storage
    .from(ANNOUNCEMENT_ATTACHMENT_BUCKET)
    .upload(storagePath, input.file, {
      contentType: input.file.type || undefined,
      upsert: false
    });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const { data, error } = await supabase
    .from('announcement_attachments')
    .insert({
      announcement_id: input.announcementId,
      file_name: fileName,
      storage_path: storagePath,
      content_type: input.file.type || null,
      file_size: input.file.size,
      uploaded_by: input.actorUserId
    })
    .select(ATTACHMENT_SELECT)
    .single();

  if (error) {
    await supabase.storage.from(ANNOUNCEMENT_ATTACHMENT_BUCKET).remove([storagePath]);
    throw new Error(error.message);
  }

  const updatedAnnouncement = await getAnnouncementById(input.announcementId);
  if (!updatedAnnouncement) {
    throw new Error('공지를 찾을 수 없습니다.');
  }

  return {
    announcement: updatedAnnouncement,
    attachment: mapAttachment(data as AnnouncementAttachmentRow)
  };
}

export async function getAnnouncementAttachmentForDownload(
  announcementId: number,
  attachmentId: number
): Promise<AnnouncementAttachmentRow | null> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from('announcement_attachments')
    .select(ATTACHMENT_SELECT)
    .eq('id', attachmentId)
    .eq('announcement_id', announcementId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as AnnouncementAttachmentRow | null) ?? null;
}

export async function downloadAnnouncementAttachment(
  row: AnnouncementAttachmentRow
): Promise<Blob> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase.storage
    .from(ANNOUNCEMENT_ATTACHMENT_BUCKET)
    .download(row.storage_path);

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function deleteAnnouncementAttachment(
  announcementId: number,
  attachmentId: number
): Promise<{ announcement: Announcement; attachment: AnnouncementAttachmentSummary } | null> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from('announcement_attachments')
    .select(ATTACHMENT_SELECT)
    .eq('id', attachmentId)
    .eq('announcement_id', announcementId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  const row = data as AnnouncementAttachmentRow;
  const { error: storageError } = await supabase.storage
    .from(ANNOUNCEMENT_ATTACHMENT_BUCKET)
    .remove([row.storage_path]);

  if (storageError) {
    throw new Error(storageError.message);
  }

  const { error: deleteError } = await supabase
    .from('announcement_attachments')
    .delete()
    .eq('id', attachmentId)
    .eq('announcement_id', announcementId);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  const announcement = await getAnnouncementById(announcementId);
  if (!announcement) {
    return null;
  }

  return {
    announcement,
    attachment: mapAttachment(row)
  };
}
