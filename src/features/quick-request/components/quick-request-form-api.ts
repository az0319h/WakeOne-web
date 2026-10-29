import type { ReactNode } from 'react';
import type { QuickRequestFormValues } from '../schemas/quick-request-form';

export type QuickRequestFormStoreState = {
  values: QuickRequestFormValues;
  isSubmitting: boolean;
};

/** `useStore(form.store, selector)` 호환 최소 구조 (TanStack Store ReadonlyStore) */
export type QuickRequestFormStoreSource = {
  get: () => QuickRequestFormStoreState;
  subscribe: (listener: (value: QuickRequestFormStoreState) => void) => {
    unsubscribe: () => void;
  };
};

export type QuickRequestFieldApi = {
  state: { value: unknown };
  handleChange: (value: unknown) => void;
  handleBlur: () => void;
  TextField: (props: Record<string, unknown>) => ReactNode;
  TextareaField: (props: Record<string, unknown>) => ReactNode;
  removeValue: (index: number) => void;
  pushValue: (value: QuickRequestFormValues['stopovers'][number]) => void;
};

export type QuickRequestOrderForm = {
  store: QuickRequestFormStoreSource;
  state: QuickRequestFormStoreState;
  AppField: (props: {
    name: string;
    mode?: 'array';
    children: (field: QuickRequestFieldApi) => ReactNode;
  }) => ReactNode;
  setFieldValue: (name: string, value: unknown) => void;
  /** plan 99 D-4 — 상세 주소가 비었는지 확인 (장소명 채움 조건) */
  getFieldValue: (name: string) => unknown;
  reset: (values?: QuickRequestFormValues) => void;
  handleSubmit: () => void | Promise<void>;
};
