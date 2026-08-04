import { Suspense } from 'react';
import { AccountDisabledToast } from '@/components/dashboard/account-disabled-toast';
import SignInViewPage from '@/features/auth/components/sign-in-view';

export default function SignInPage() {
  return (
    <>
      <Suspense fallback={null}>
        <AccountDisabledToast />
      </Suspense>
      <SignInViewPage />
    </>
  );
}
