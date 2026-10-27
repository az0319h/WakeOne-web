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

/** plan 89 — 업무는 성공했지만 부가 처리(예: 오픈채팅 자동 발송)가 실패했을 때 */
export function notifyWarning(message: string, duration = 8000) {
  toast.warning(message, { duration });
}
