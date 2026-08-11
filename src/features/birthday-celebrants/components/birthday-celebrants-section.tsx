import { getBirthdayCelebrantsServer } from '../api/service.server';
import { BirthdayCelebrantsBanner } from './birthday-celebrants-banner';

export async function BirthdayCelebrantsSection() {
  const data = await getBirthdayCelebrantsServer();

  if (data.celebrants.length === 0) {
    return null;
  }

  return <BirthdayCelebrantsBanner data={data} />;
}
