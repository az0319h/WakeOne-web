export type WalletTransactionType = 'deposit' | 'withdrawal' | 'payment' | 'refund';

export interface WalletTransaction {
  id: string;
  type: WalletTransactionType;
  description: string;
  amount: number;
  balance: number;
  createdAt: string;
}

export interface WalletPaymentMethod {
  brand: string;
  last4: string;
  expiryMonth: number;
  expiryYear: number;
  isDefault: boolean;
}

export const WALLET_PRESET_AMOUNTS = [10_000, 30_000, 50_000, 100_000] as const;

export const MOCK_INITIAL_BALANCE = 125_000;

export const MOCK_AUTO_RELOAD = {
  enabled: true,
  threshold: 20_000,
  reloadAmount: 50_000
};

export const MOCK_PAYMENT_METHOD: WalletPaymentMethod = {
  brand: 'Visa',
  last4: '4242',
  expiryMonth: 12,
  expiryYear: 2028,
  isDefault: true
};

export const MOCK_TRANSACTIONS: WalletTransaction[] = [
  {
    id: 'tx-1',
    type: 'payment',
    description: '계약서 등록 수수료',
    amount: -15_000,
    balance: 125_000,
    createdAt: '2026-07-17T09:12:00.000Z'
  },
  {
    id: 'tx-2',
    type: 'deposit',
    description: '지갑 충전',
    amount: 50_000,
    balance: 140_000,
    createdAt: '2026-07-16T14:30:00.000Z'
  },
  {
    id: 'tx-3',
    type: 'refund',
    description: '취소된 결제 환불',
    amount: 8_500,
    balance: 90_000,
    createdAt: '2026-07-15T11:05:00.000Z'
  },
  {
    id: 'tx-4',
    type: 'withdrawal',
    description: '정산 출금',
    amount: -30_000,
    balance: 81_500,
    createdAt: '2026-07-14T16:45:00.000Z'
  },
  {
    id: 'tx-5',
    type: 'deposit',
    description: '자동 충전',
    amount: 50_000,
    balance: 111_500,
    createdAt: '2026-07-13T08:20:00.000Z'
  },
  {
    id: 'tx-6',
    type: 'payment',
    description: '프리미엄 기능 이용',
    amount: -12_000,
    balance: 61_500,
    createdAt: '2026-07-12T19:40:00.000Z'
  }
];
