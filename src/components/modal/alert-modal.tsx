'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { DialogFooter } from '@/components/ui/dialog';
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
      {/* 휴대폰(md 미만): 확인 위 · 취소 아래 세로 꽉 찬 44px 버튼 / md↑: 기존처럼 오른쪽 정렬 가로 h-9 */}
      <DialogFooter className='pt-6 sm:flex-col-reverse md:flex-row md:items-center md:justify-end'>
        <Button
          disabled={loading}
          variant='outline'
          className='h-11 w-full md:h-9 md:w-auto'
          onClick={onClose}
        >
          {cancelLabel}
        </Button>
        <Button
          isLoading={loading}
          variant={confirmVariant}
          className='h-11 w-full md:h-9 md:w-auto'
          onClick={onConfirm}
        >
          {confirmLabel}
        </Button>
      </DialogFooter>
    </Modal>
  );
}
