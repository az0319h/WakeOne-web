'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';

interface SupportSheetContextValue {
  formOpen: boolean;
  setFormOpen: (open: boolean) => void;
}

const SupportSheetContext = createContext<SupportSheetContextValue | null>(null);

interface SupportSheetProviderProps {
  children: ReactNode;
}

export function SupportSheetProvider({ children }: SupportSheetProviderProps) {
  const [formOpen, setFormOpen] = useState(false);

  return (
    <SupportSheetContext value={{ formOpen, setFormOpen }}>{children}</SupportSheetContext>
  );
}

export function useSupportSheet() {
  const context = useContext(SupportSheetContext);
  if (!context) {
    throw new Error('useSupportSheet must be used within SupportSheetProvider');
  }
  return context;
}
