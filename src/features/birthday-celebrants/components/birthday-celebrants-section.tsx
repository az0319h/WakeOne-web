import { overviewDataDelay } from '@/lib/delay';
import { getBirthdayCelebrantsServer } from '../api/service.server';
import { BirthdayCelebrantsBanner } from './birthday-celebrants-banner';

export async function BirthdayCelebrantsSection() {
  await overviewDataDelay();
  const data = await getBirthdayCelebrantsServer();

  if (data.celebrants.length === 0) {
    return null;
  }

  return <BirthdayCelebrantsBanner data={data} />;
}
