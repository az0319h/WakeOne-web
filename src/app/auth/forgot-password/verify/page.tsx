import { redirect } from 'next/navigation';
import { ForgotPasswordVerifyView } from '@/features/auth/components/forgot-password-verify-view';
import { forgotPasswordSearchParamsCache } from '@/features/auth/searchparams/forgot-password';

interface ForgotPasswordVerifyPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ForgotPasswordVerifyPage({
  searchParams
}: ForgotPasswordVerifyPageProps) {
  const { email } = forgotPasswordSearchParamsCache.parse(await searchParams);

  if (!email) {
    redirect('/auth/forgot-password');
  }

  return <ForgotPasswordVerifyView email={email} />;
}
