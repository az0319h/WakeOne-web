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
    throw new Error(
      data.message ??
        '비밀번호 변경 조건을 충족하지 못했습니다. 현재 비밀번호 확인과 새 비밀번호 설정을 다시 시도해 주세요.'
    );
  }

  return data;
}
