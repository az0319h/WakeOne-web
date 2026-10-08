'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  filterLightboxAttachments,
  type OpenAttachmentLightboxParams
} from '../api/types';
import {
  AttachmentLightboxDialog,
  type AttachmentLightboxDialogState
} from './attachment-lightbox-dialog';

let openAttachmentLightboxImpl: ((params: OpenAttachmentLightboxParams) => void) | null =
  null;

export function openAttachmentLightbox(params: OpenAttachmentLightboxParams) {
  openAttachmentLightboxImpl?.(params);
}

type AttachmentLightboxProviderProps = {
  children: React.ReactNode;
};

export function AttachmentLightboxProvider({
  children
}: AttachmentLightboxProviderProps) {
  const [state, setState] = useState<AttachmentLightboxDialogState | null>(null);

  const handleOpen = useCallback((params: OpenAttachmentLightboxParams) => {
    const inlineAttachments = filterLightboxAttachments(params.attachments);
    if (inlineAttachments.length === 0) {
      return;
    }

    const initialIndex = Math.max(
      0,
      inlineAttachments.findIndex((item) => item.id === params.initialAttachmentId)
    );

    setState({
      source: params.source,
      attachments: inlineAttachments,
      initialIndex
    });
  }, []);

  useEffect(() => {
    openAttachmentLightboxImpl = handleOpen;
    return () => {
      openAttachmentLightboxImpl = null;
    };
  }, [handleOpen]);

  return (
    <>
      {children}
      <AttachmentLightboxDialog
        state={state}
        onOpenChange={(open) => {
          if (!open) {
            setState(null);
          }
        }}
      />
    </>
  );
}
