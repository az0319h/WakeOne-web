'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';

interface AlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** 확인 버튼 색 — 기본 `destructive`. 승인처럼 파괴적이지 않은 확정은 `default` (plan 89 K4) */
  confirmVariant?: 'destructive' | 'default';
  /** 설명과 버튼 사이 추가 입력 (예: 취소 사유 Textarea) */
  children?: ReactNode;
}

export function AlertModal({
  isOpen,
  onClose,
  onConfirm,
  loading,
  title = 'Are you sure?',
  description = 'This action cannot be undone.',
  confirmLabel = 'Continue',
  cancelLabel = 'Cancel',
  confirmVariant = 'destructive',
  children
}: AlertModalProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return null;
  }

  return (
    <Modal
      title={title}
      description={description}
      isOpen={isOpen}
      onClose={() => {
        if (!loading) {
          onClose();
        }
      }}
    >
      {children ? <div className='pt-4'>{children}</div> : null}
      <div className='flex w-full items-center justify-end space-x-2 pt-6'>
        <Button disabled={loading} variant='outline' onClick={onClose}>
          {cancelLabel}
        </Button>
        <Button
          isLoading={loading}
          variant={confirmVariant}
          onClick={onConfirm}
        >
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
