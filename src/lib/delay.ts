const OVERVIEW_SKELETON_DEBUG_DELAY_MS = 3000;

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** /dashboard/overview 위젯 스켈레톤 확인용 — development에서만 3초 대기 */
export async function overviewDataDelay(): Promise<void> {
  if (process.env.NODE_ENV !== 'development') {
    return;
  }

  await delay(OVERVIEW_SKELETON_DEBUG_DELAY_MS);
}
