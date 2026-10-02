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
