'use client';

import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';

interface IosInstallGuideDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STEPS = [
  { icon: Icons.share, text: 'Safari 하단의 공유 버튼을 누르세요' },
  { icon: Icons.add, text: '「홈 화면에 추가」를 선택하세요' },
  {
    icon: Icons.notification,
    text: '홈 화면의 WakeOne 아이콘으로 열고 프로필 → 휴대폰 알림을 켜세요'
  }
] as const;

/** plan 91 — 아이폰 홈 화면 추가 안내 (iOS 16.4+ 웹 푸시는 설치된 웹앱에서만 동작) */
export function IosInstallGuideDialog({ open, onOpenChange }: IosInstallGuideDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-sm' data-testid='ios-install-guide-dialog'>
        <DialogHeader>
          <DialogTitle>아이폰에서 알림 받기</DialogTitle>
          <DialogDescription>
            홈 화면에 추가한 WakeOne 아이콘으로 열어야 알림을 켤 수 있어요.
          </DialogDescription>
        </DialogHeader>
        <ol className='space-y-3'>
          {STEPS.map((step, index) => {
            const StepIcon = step.icon;
            return (
              <li key={step.text} className='flex items-start gap-3'>
                <span className='bg-primary text-primary-foreground flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold'>
                  {index + 1}
                </span>
                <StepIcon className='text-muted-foreground mt-0.5 size-4 shrink-0' aria-hidden />
                <p className='text-sm leading-relaxed'>{step.text}</p>
              </li>
            );
          })}
        </ol>
        <p className='text-muted-foreground text-xs'>iOS 16.4 이상에서 지원됩니다.</p>
        <DialogFooter>
          <Button type='button' onClick={() => onOpenChange(false)}>
            확인
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
