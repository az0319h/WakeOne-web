import { mutationOptions } from '@tanstack/react-query';
import { getQueryClient } from '@/lib/query-client';
import { contractKeys } from './queries';
import {
  setContractNoAttachment,
  softDeleteContract,
  softDeleteContractAttachment,
  updateContract,
  uploadContractAttachment
} from './service';
import type { ContractNoAttachmentPayload, ContractUpdatePayload } from './types';

function invalidateContracts() {
  getQueryClient().invalidateQueries({ queryKey: contractKeys.all });
}

export const updateContractMutation = mutationOptions({
  mutationFn: ({ id, payload }: { id: number; payload: ContractUpdatePayload }) =>
    updateContract(id, payload),
  onSettled: invalidateContracts
});

export const softDeleteContractMutation = mutationOptions({
  mutationFn: (id: number) => softDeleteContract(id),
  onSettled: invalidateContracts
});

export const uploadContractAttachmentMutation = mutationOptions({
  mutationFn: ({ id, file }: { id: number; file: File }) => uploadContractAttachment(id, file),
  onSettled: invalidateContracts
});

export const softDeleteContractAttachmentMutation = mutationOptions({
  mutationFn: ({ id, attachmentId }: { id: number; attachmentId: number }) =>
    softDeleteContractAttachment(id, attachmentId),
  onSettled: invalidateContracts
});

export const setContractNoAttachmentMutation = mutationOptions({
  mutationFn: ({ id, payload }: { id: number; payload: ContractNoAttachmentPayload }) =>
    setContractNoAttachment(id, payload),
  onSettled: invalidateContracts
});
