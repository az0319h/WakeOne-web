import { requireDashboardSession } from '@/features/auth/api/session.server';

export default async function AttachmentViewerLayout({
  children
}: {
  children: React.ReactNode;
}) {
  await requireDashboardSession();

  return <div className='bg-background fixed inset-0 z-50 flex flex-col'>{children}</div>;
}
