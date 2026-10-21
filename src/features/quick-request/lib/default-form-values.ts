import { PHONE_REGEX } from '@/lib/phone';
import type { QuickRequestFormValues } from '../schemas/quick-request-form';

export function buildQuickRequestDefaultValues(profile: {
  full_name: string;
  phone: string | null;
}): QuickRequestFormValues {
  const phone =
    profile.phone && PHONE_REGEX.test(profile.phone) ? profile.phone : '';

  const emptyLocation = {
    roadAddress: '',
    detailAddress: '',
    contactName: '',
    contactPhone: ''
  };

  return {
    goodsSize: '',
    itemDescription: '',
    vehicleTypes: [],
    vehicleOtherText: '',
    vehicleCountMode: 'preset',
    vehicleCountPreset: 1,
    vehicleCountCustom: undefined,
    origin: {
      ...emptyLocation,
      contactName: profile.full_name,
      contactPhone: phone,
      scheduleMode: 'immediate',
      scheduledDatetime: '',
      notes: [],
      memo: ''
    },
    stopovers: [],
    destination: {
      ...emptyLocation,
      scheduleMode: 'asap',
      scheduledDatetime: '',
      notes: [],
      extraMemo: ''
    },
    freightPayment: 'monthly'
  };
}

export function emptyStopoverLocation(): QuickRequestFormValues['stopovers'][number] {
  return {
    roadAddress: '',
    detailAddress: '',
    contactName: '',
    contactPhone: ''
  };
}
