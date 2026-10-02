import 'server-only';

export async function inviteUserWithTemporaryPassword(): Promise<never> {
  throw new Error('임시 비밀번호 초대는 종료되었습니다. Google 로그인 승인 흐름을 사용해 주세요.');
}
