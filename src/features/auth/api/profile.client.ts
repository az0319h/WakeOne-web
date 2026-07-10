type ChangePasswordPayload = {
  current_password: string;
  new_password: string;
  confirm_password: string;
};

export async function changePassword(payload: ChangePasswordPayload) {
  const res = await fetch('/api/profile/password', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const data = (await res.json()) as { success: boolean; message?: string };

  if (!res.ok) {
    throw new Error(data.message ?? '비밀번호 변경에 실패했습니다.');
  }

  return data;
}
