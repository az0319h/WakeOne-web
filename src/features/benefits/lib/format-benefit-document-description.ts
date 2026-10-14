import type { BenefitType } from '../api/types';

const FITNESS_SESSION_SEPARATOR = ' · ';

/**
 * Flex automation may store fitness descriptions as「활동 · 회차」.
 * UI shows the activity label only (e.g.「헬스」).
 */
export function formatBenefitDocumentDescription(
  benefitType: BenefitType,
  description: string
): string {
  if (benefitType !== 'fitness') {
    return description;
  }

  const separatorIndex = description.indexOf(FITNESS_SESSION_SEPARATOR);
  if (separatorIndex === -1) {
    return description;
  }

  const activity = description.slice(0, separatorIndex).trim();
  return activity === '' ? description : activity;
}
