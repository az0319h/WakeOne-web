import { mutationOptions } from '@tanstack/react-query';
import { getQueryClient } from '@/lib/query-client';
import { syncAnnouncementInCache } from './cache-sync';
import { announcementKeys } from './keys';
import {
  createAnnouncement,
  deleteAnnouncement,
  deleteAnnouncementAttachment,
  notifyAnnouncementPublished,
  updateAnnouncement,
  uploadAnnouncementAttachment
} from './service';
import type { AnnouncementCreatePayload, AnnouncementUpdatePayload } from './types';

function invalidateAnnouncements() {
  getQueryClient().invalidateQueries({ queryKey: announcementKeys.all });
}

export const createAnnouncementMutation = mutationOptions({
  mutationFn: (payload: AnnouncementCreatePayload) => createAnnouncement(payload),
  onSuccess: (response) => {
    syncAnnouncementInCache(response.announcement);
  },
  onSettled: invalidateAnnouncements
});

export const updateAnnouncementMutation = mutationOptions({
  mutationFn: ({ id, payload }: { id: number; payload: AnnouncementUpdatePayload }) =>
    updateAnnouncement(id, payload),
  onSuccess: (response) => {
    syncAnnouncementInCache(response.announcement);
  },
  onSettled: invalidateAnnouncements
});

export const deleteAnnouncementMutation = mutationOptions({
  mutationFn: (id: number) => deleteAnnouncement(id),
  onSettled: invalidateAnnouncements
});

export const notifyAnnouncementPublishedMutation = mutationOptions({
  mutationFn: (id: number) => notifyAnnouncementPublished(id),
  onSettled: invalidateAnnouncements
});

export const uploadAnnouncementAttachmentMutation = mutationOptions({
  mutationFn: ({ announcementId, file }: { announcementId: number; file: File }) =>
    uploadAnnouncementAttachment(announcementId, file),
  onSuccess: (response) => {
    syncAnnouncementInCache(response.announcement);
  },
  onSettled: invalidateAnnouncements
});

export const deleteAnnouncementAttachmentMutation = mutationOptions({
  mutationFn: ({
    announcementId,
    attachmentId
  }: {
    announcementId: number;
    attachmentId: number;
  }) => deleteAnnouncementAttachment(announcementId, attachmentId),
  onSuccess: (response) => {
    syncAnnouncementInCache(response.announcement);
  },
  onSettled: invalidateAnnouncements
});
