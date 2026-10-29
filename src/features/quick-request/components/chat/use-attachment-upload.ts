'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { notifyError } from '@/lib/notify';
import { deleteQuickChatAttachmentMutation, prepareQuickChatAttachmentsMutation } from '../../api/mutations';
import type { QuickRequestMessageAttachmentPrepared } from '../../api/types';
import type { QuickChatAttachmentItem } from '../../lib/quick-chat-cache';
import {
  QUICK_CHAT_ATTACHMENT_MAX_COUNT,
  QUICK_CHAT_UPLOAD_CONCURRENCY,
  classifyFile
} from '../../lib/quick-chat-attachments';
import {
  QUICK_CHAT_ATTACHMENT_MESSAGES,
  type QuickChatAttachmentExtension,
  type QuickChatAttachmentKind
} from '../../schemas/quick-request-attachment';
import { QUICK_CHAT_TEXT } from './quick-chat-constants';

export type QuickChatUploadState = 'uploading' | 'uploaded' | 'failed';

/** 첨부 대기 줄 항목 (designer §3-1 · `data-state`) */
export type QuickChatUploadItem = {
  localId: string;
  file: File;
  kind: QuickChatAttachmentKind;
  extension: QuickChatAttachmentExtension;
  mimeType: string;
  fileName: string;
  fileSize: number;
  /** 이미지만 — ObjectURL (칩 썸네일 → 전송 시 optimistic 말풍선이 이어받아 201 후 revoke) */
  previewUrl?: string;
  state: QuickChatUploadState;
  /** 0~100 */
  progress: number;
  /** prepare 응답 id — 업로드 성공 후 `attachmentIds`로 전송 · ✕는 pending DELETE */
  attachmentId: number | null;
  errorMessage?: string;
};

export type UseAttachmentUploadResult = {
  items: QuickChatUploadItem[];
  add: (files: readonly File[]) => void;
  remove: (localId: string) => void;
  retry: (localId: string) => void;
  /** 전송 직후 — 항목만 비운다 (ObjectURL·pending 행은 말풍선·전송이 책임) */
  clear: () => void;
  /** 업로드 완료 항목의 optimistic 스냅샷 (`previewUrl` 포함) */
  snapshot: () => QuickChatAttachmentItem[];
  uploadedIds: number[];
  uploadedCount: number;
  isUploading: boolean;
  hasFailed: boolean;
  max: number;
};

type UseAttachmentUploadOptions = {
  requestNo: string;
};

function createLocalId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function revokePreview(item: Pick<QuickChatUploadItem, 'previewUrl'>) {
  if (item.previewUrl && typeof URL !== 'undefined') {
    URL.revokeObjectURL(item.previewUrl);
  }
}

/**
 * XHR PUT — `fetch`는 업로드 진행률이 없어 XHR을 쓴다 (designer §4 · raw fetch 예외 승인분).
 * Supabase `createSignedUploadUrl`의 `signedUrl`에 본문 = 파일 그대로 PUT.
 */
function putWithProgress(
  url: string,
  file: File,
  onProgress: (percent: number) => void
): { promise: Promise<void>; xhr: XMLHttpRequest } {
  const xhr = new XMLHttpRequest();
  const promise = new Promise<void>((resolve, reject) => {
    xhr.open('PUT', url, true);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100);
        resolve();
      } else {
        reject(new Error(`upload ${xhr.status}`));
      }
    };
    xhr.onerror = () => reject(new Error('upload network error'));
    xhr.onabort = () => reject(new Error('upload aborted'));
    xhr.send(file);
  });
  return { promise, xhr };
}

/**
 * plan 98 D-4·D-7 — 선택 즉시 검사 → `prepare` 1회(묶음) → XHR PUT 동시 3개(진행률) → `uploadedIds`.
 * 실패 ↻는 같은 서명 URL 재PUT이 409(`upsert:false`)라 **prepare를 다시 호출**한다(backend §9). ✕는 abort + pending DELETE.
 * 상태 머신: `uploading(0~100)` → `uploaded` | `failed` → (↻) `uploading` · (✕) 제거.
 */
export function useAttachmentUpload({ requestNo }: UseAttachmentUploadOptions): UseAttachmentUploadResult {
  const [items, setItems] = useState<QuickChatUploadItem[]>([]);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const xhrsRef = useRef(new Map<string, XMLHttpRequest>());
  const queueRef = useRef<Array<{ localId: string; prepared: QuickRequestMessageAttachmentPrepared }>>([]);
  const activeRef = useRef(0);

  const prepareMutation = useMutation(prepareQuickChatAttachmentsMutation);
  const deleteMutation = useMutation(deleteQuickChatAttachmentMutation);
  const prepareAsync = prepareMutation.mutateAsync;
  const deleteMutate = deleteMutation.mutate;

  const patch = useCallback((localId: string, updater: (item: QuickChatUploadItem) => QuickChatUploadItem) => {
    setItems((current) => current.map((item) => (item.localId === localId ? updater(item) : item)));
  }, []);

  const pump = useCallback(() => {
    while (activeRef.current < QUICK_CHAT_UPLOAD_CONCURRENCY && queueRef.current.length > 0) {
      const next = queueRef.current.shift();
      if (!next) break;
      const item = itemsRef.current.find((candidate) => candidate.localId === next.localId);
      // ✕로 이미 제거됐으면 건너뛴다
      if (!item) continue;
      activeRef.current += 1;
      const { promise, xhr } = putWithProgress(next.prepared.uploadUrl, item.file, (percent) =>
        patch(next.localId, (current) => ({ ...current, progress: percent }))
      );
      xhrsRef.current.set(next.localId, xhr);
      promise
        .then(() => {
          patch(next.localId, (current) => ({ ...current, state: 'uploaded', progress: 100 }));
        })
        .catch(() => {
          // abort(✕)면 항목이 이미 제거됐으므로 patch는 no-op
          patch(next.localId, (current) => ({
            ...current,
            state: 'failed',
            errorMessage: QUICK_CHAT_TEXT.uploadFailed
          }));
        })
        .finally(() => {
          xhrsRef.current.delete(next.localId);
          activeRef.current -= 1;
          pump();
        });
    }
  }, [patch]);

  /** prepare(묶음 1회) → 큐 적재. 4xx면 묶음 전체 `failed` + 서버 문구 토스트 */
  const prepareAndEnqueue = useCallback(
    async (batch: readonly QuickChatUploadItem[]) => {
      if (batch.length === 0) return;
      let prepared: QuickRequestMessageAttachmentPrepared[];
      try {
        const result = await prepareAsync({
          requestNo,
          payload: {
            files: batch.map((item) => ({ name: item.fileName, size: item.fileSize, mime: item.mimeType }))
          }
        });
        prepared = result.attachments;
      } catch (error) {
        const message =
          error instanceof Error && error.message ? error.message : QUICK_CHAT_ATTACHMENT_MESSAGES.prepareFailed;
        notifyError(message);
        const ids = new Set(batch.map((item) => item.localId));
        setItems((current) =>
          current.map((item) =>
            ids.has(item.localId) ? { ...item, state: 'failed', errorMessage: QUICK_CHAT_TEXT.uploadFailed } : item
          )
        );
        return;
      }
      batch.forEach((item, index) => {
        const entry = prepared[index];
        if (!entry) {
          patch(item.localId, (current) => ({ ...current, state: 'failed', errorMessage: QUICK_CHAT_TEXT.uploadFailed }));
          return;
        }
        patch(item.localId, (current) => ({ ...current, attachmentId: entry.attachmentId }));
        queueRef.current.push({ localId: item.localId, prepared: entry });
      });
      pump();
    },
    [patch, prepareAsync, pump, requestNo]
  );

  const add = useCallback(
    (files: readonly File[]) => {
      if (files.length === 0) return;
      const reasons = new Set<'type' | 'size'>();
      const accepted: QuickChatUploadItem[] = [];
      const room = QUICK_CHAT_ATTACHMENT_MAX_COUNT - itemsRef.current.length;
      let overflow = false;

      for (const file of files) {
        const result = classifyFile(file);
        if (!result.ok) {
          reasons.add(result.reason);
          continue;
        }
        if (accepted.length >= room) {
          overflow = true;
          continue;
        }
        accepted.push({
          localId: createLocalId(),
          file,
          kind: result.kind,
          extension: result.extension,
          mimeType: result.mimeType,
          fileName: file.name,
          fileSize: file.size,
          previewUrl: result.kind === 'image' && typeof URL !== 'undefined' ? URL.createObjectURL(file) : undefined,
          state: 'uploading',
          progress: 0,
          attachmentId: null
        });
      }

      // 같은 사유는 1회 · 문구는 서버 원문 그대로 · 파일명은 toast에 넣지 않는다 (AC-04 · designer §3-1)
      if (reasons.has('type')) notifyError(QUICK_CHAT_ATTACHMENT_MESSAGES.invalidType);
      if (reasons.has('size')) notifyError(QUICK_CHAT_ATTACHMENT_MESSAGES.fileTooLarge);
      if (overflow) notifyError(QUICK_CHAT_ATTACHMENT_MESSAGES.tooMany);
      if (accepted.length === 0) return;

      setItems((current) => [...current, ...accepted]);
      void prepareAndEnqueue(accepted);
    },
    [prepareAndEnqueue]
  );

  const remove = useCallback(
    (localId: string) => {
      const item = itemsRef.current.find((candidate) => candidate.localId === localId);
      if (!item) return;
      queueRef.current = queueRef.current.filter((entry) => entry.localId !== localId);
      xhrsRef.current.get(localId)?.abort();
      xhrsRef.current.delete(localId);
      if (item.attachmentId !== null) {
        // pending 행 취소 — fire-and-forget (실패해도 24h 뒤 정리 대상)
        deleteMutate({ requestNo, attachmentId: item.attachmentId });
      }
      revokePreview(item);
      setItems((current) => current.filter((candidate) => candidate.localId !== localId));
    },
    [deleteMutate, requestNo]
  );

  const retry = useCallback(
    (localId: string) => {
      const item = itemsRef.current.find((candidate) => candidate.localId === localId);
      if (!item || item.state !== 'failed') return;
      if (item.attachmentId !== null) {
        deleteMutate({ requestNo, attachmentId: item.attachmentId });
      }
      const fresh: QuickChatUploadItem = {
        ...item,
        state: 'uploading',
        progress: 0,
        attachmentId: null,
        errorMessage: undefined
      };
      patch(localId, () => fresh);
      void prepareAndEnqueue([fresh]);
    },
    [deleteMutate, patch, prepareAndEnqueue, requestNo]
  );

  const clear = useCallback(() => {
    queueRef.current = [];
    for (const xhr of xhrsRef.current.values()) xhr.abort();
    xhrsRef.current.clear();
    setItems([]);
  }, []);

  const snapshot = useCallback((): QuickChatAttachmentItem[] => {
    const result: QuickChatAttachmentItem[] = [];
    for (const item of itemsRef.current) {
      if (item.state !== 'uploaded' || item.attachmentId === null) continue;
      result.push({
        id: item.attachmentId,
        kind: item.kind,
        fileName: item.fileName,
        fileSize: item.fileSize,
        extension: item.extension,
        mimeType: item.mimeType,
        previewUrl: item.previewUrl
      });
    }
    return result;
  }, []);

  // 언마운트 — 진행 중 업로드 중단 · 아직 대기 줄에 남은 항목의 ObjectURL 해제 (전송된 항목은 `clear()`로 이미 빠져 있다)
  useEffect(() => {
    const xhrs = xhrsRef.current;
    return () => {
      for (const xhr of xhrs.values()) xhr.abort();
      xhrs.clear();
      for (const item of itemsRef.current) revokePreview(item);
    };
  }, []);

  const derived = useMemo(() => {
    const uploadedIds: number[] = [];
    let isUploading = false;
    let hasFailed = false;
    for (const item of items) {
      if (item.state === 'uploaded' && item.attachmentId !== null) uploadedIds.push(item.attachmentId);
      else if (item.state === 'uploading') isUploading = true;
      else if (item.state === 'failed') hasFailed = true;
    }
    return { uploadedIds, isUploading, hasFailed };
  }, [items]);

  return {
    items,
    add,
    remove,
    retry,
    clear,
    snapshot,
    uploadedIds: derived.uploadedIds,
    uploadedCount: derived.uploadedIds.length,
    isUploading: derived.isUploading,
    hasFailed: derived.hasFailed,
    max: QUICK_CHAT_ATTACHMENT_MAX_COUNT
  };
}
