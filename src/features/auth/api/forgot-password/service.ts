import type {
  ForgotPasswordRequestPayload,
  ForgotPasswordResponse,
  ForgotPasswordVerifyPayload
} from './types';

const GENERIC_ERROR = '요청 처리에 실패했습니다. 잠시 후 다시 시도해 주세요.';

async function parseForgotPasswordResponse(res: Response): Promise<ForgotPasswordResponse> {
  const data = (await res.json()) as ForgotPasswordResponse;
  return data;
}

export async function requestPasswordReset(
  payload: ForgotPasswordRequestPayload
): Promise<ForgotPasswordResponse> {
  const res = await fetch('/api/auth/forgot-password/request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const data = await parseForgotPasswordResponse(res);

  if (!res.ok) {
    throw new Error(data.message ?? GENERIC_ERROR);
  }

  return data;
}

export async function verifyPasswordResetOtp(
  payload: ForgotPasswordVerifyPayload
): Promise<ForgotPasswordResponse> {
  const res = await fetch('/api/auth/forgot-password/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const data = await parseForgotPasswordResponse(res);

  if (!res.ok) {
    throw new Error(data.message ?? GENERIC_ERROR);
  }

  return data;
}
