export type WalletBalanceEmailSlot = 1 | 2;

export type WalletBalanceEmailSlotCopy = {
  emailSubject: string;
  emailHtmlTitle: string;
  emailHtmlSubtitle: string;
  emailTextIntro: string;
  inAppTitle: string;
  inAppBody: string;
  settingsLabel: string;
};

export const WALLET_BALANCE_EMAIL_SLOT_COPY: Record<
  WalletBalanceEmailSlot,
  WalletBalanceEmailSlotCopy
> = {
  1: {
    emailSubject: '[WakeOne] 식대 잔액 안내',
    emailHtmlTitle: '식대 잔액 안내',
    emailHtmlSubtitle: '오늘 사용 가능한 식대 잔액입니다.',
    emailTextIntro: '오늘 사용 가능한 식대 잔액입니다.',
    inAppTitle: '식대 잔액 안내',
    inAppBody: '남은 식대를 확인해 보세요.',
    settingsLabel: '식대 잔액 안내'
  },
  2: {
    emailSubject: '[WakeOne] 식사 맛있게 하셨나요?',
    emailHtmlTitle: '식사 맛있게 하셨나요?',
    emailHtmlSubtitle: '식사 후 남은 식대 잔액을 확인해 보세요.',
    emailTextIntro: '식사 후 남은 식대 잔액을 확인해 보세요.',
    inAppTitle: '식사 맛있게 하셨나요?',
    inAppBody: '남은 식대를 한번 더 확인해 보세요.',
    settingsLabel: '식사 맛있게 하셨나요?'
  }
} as const;

export function formatWalletBalanceEmailSlotSettingsLabel(
  slot: WalletBalanceEmailSlot
): string {
  return `알림 ${slot} · ${WALLET_BALANCE_EMAIL_SLOT_COPY[slot].settingsLabel}`;
}
