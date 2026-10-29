import { getBirthdayCelebrantsServer } from '../api/service.server';
import { BirthdayCelebrantsWheelCard } from './birthday-celebrants-wheel-card';

/** plan 102 — overview 생일 카드 (RSC). 회사 전체 0명이면 카드 자체를 숨긴다(D-13). */
export async function BirthdayCelebrantsSection() {
  const data = await getBirthdayCelebrantsServer();

  if (data.celebrants.length === 0) {
    return null;
  }

  return <BirthdayCelebrantsWheelCard data={data} />;
}
