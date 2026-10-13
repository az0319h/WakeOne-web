import { mutationOptions } from '@tanstack/react-query';
import { getQueryClient } from '@/lib/query-client';
import { cancelBenefitDocument, restoreBenefitDocument } from './service';
import { benefitKeys } from './queries';

export const cancelBenefitDocumentMutation = mutationOptions({
  mutationFn: (documentId: number) => cancelBenefitDocument(documentId),
  onSettled: () => {
    void getQueryClient().invalidateQueries({ queryKey: benefitKeys.all });
  }
});

export const restoreBenefitDocumentMutation = mutationOptions({
  mutationFn: (documentId: number) => restoreBenefitDocument(documentId),
  onSettled: () => {
    void getQueryClient().invalidateQueries({ queryKey: benefitKeys.all });
  }
});
