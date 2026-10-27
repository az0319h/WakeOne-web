import { toast } from 'sonner';

export function notifySuccess(message: string) {
  toast.success(message);
}

export function notifyError(message: string, duration = 8000) {
  toast.error(message, { duration });
}

export function notifyInfo(message: string) {
  toast.info(message);
}

/** 업무는 성공했지만 부가 처리가 실패했을 때 (공용 유틸 · 현재 사용처 없음) */
export function notifyWarning(message: string, duration = 8000) {
  toast.warning(message, { duration });
}
