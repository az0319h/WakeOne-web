export function formatWalletAmount(amount: number): string {
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW',
    maximumFractionDigits: 0
  }).format(amount);
}

export function formatSignedWalletAmount(amount: number): string {
  const formatted = formatWalletAmount(Math.abs(amount));

  if (amount > 0) {
    return `+${formatted}`;
  }

  if (amount < 0) {
    return `-${formatted}`;
  }

  return formatted;
}

/** 부여한도 대비 사용률(%)을 0~100 정수로 반환한다. */
export function calculateWalletUsagePercent(limit: number, remaining: number): number {
  if (limit <= 0) {
    return 0;
  }

  const used = Math.min(Math.max(limit - remaining, 0), limit);

  return Math.round((used / limit) * 100);
}
