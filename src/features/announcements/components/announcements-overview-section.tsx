import { overviewDataDelay } from '@/lib/delay';
import { listAnnouncementsOverview } from '../api/service.server';
import { AnnouncementsOverviewCard } from './announcements-overview-card';

export async function AnnouncementsOverviewSection() {
  await overviewDataDelay();
  const announcements = await listAnnouncementsOverview();

  if (announcements.length === 0) {
    return null;
  }

  return <AnnouncementsOverviewCard announcements={announcements} />;
}
