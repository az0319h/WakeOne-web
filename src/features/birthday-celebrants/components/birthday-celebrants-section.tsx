import { getBirthdayCelebrantsServer } from '../api/service.server';
import { BirthdayCelebrantsBanner } from './birthday-celebrants-banner';

export async function BirthdayCelebrantsSection() {
  const data = await getBirthdayCelebrantsServer();

  if (data.celebrants.length === 0) {
    return null;
  }

  return (
    <div className='col-span-4 md:col-span-3'>
      <BirthdayCelebrantsBanner data={data} />
    </div>
  );
}
