import { getSessionProfile } from '@/features/auth/api/session.server';
import { overviewDataDelay } from '@/lib/delay';
import { getWalletSummaryServer } from '../api/service.server';
import { WalletSummaryOverviewCard } from './wallet-summary-overview-card';

export async function WalletSummaryOverviewSection() {
  await overviewDataDelay();
  const profile = await getSessionProfile();

  if (!profile) {
    return null;
  }

  const isAdmin = profile.system_role === 'admin';
  const { snapshot } = await getWalletSummaryServer(profile.user_id, isAdmin, null);

  return <WalletSummaryOverviewCard snapshot={snapshot} />;
}
