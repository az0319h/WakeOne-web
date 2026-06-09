import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ACCESS_DENIED_FLASH_COOKIE } from './access-denied-flash';

export async function redirectWithAccessDeniedFlash(
  key: string,
  path = '/dashboard/overview'
): Promise<never> {
  const cookieStore = await cookies();
  cookieStore.set(ACCESS_DENIED_FLASH_COOKIE, key, {
    maxAge: 30,
    path: '/',
    sameSite: 'lax',
    httpOnly: false
  });
  redirect(path);
}
