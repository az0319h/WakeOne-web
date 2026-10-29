import { mutationOptions } from '@tanstack/react-query';
import { getQueryClient } from '@/lib/query-client';
import { equipmentKeys } from './keys';
import { createEquipment, deleteEquipment, updateEquipment } from './service';
import type { EquipmentPayload } from './types';

/** 대장 CUD → 대장 목록·단건·자산번호 제안 invalidate */
function invalidateEquipment() {
  getQueryClient().invalidateQueries({ queryKey: equipmentKeys.all });
}

export const createEquipmentMutation = mutationOptions({
  mutationFn: (payload: EquipmentPayload) => createEquipment(payload),
  onSettled: invalidateEquipment
});

export const updateEquipmentMutation = mutationOptions({
  mutationFn: ({ id, payload }: { id: number; payload: Partial<EquipmentPayload> }) =>
    updateEquipment(id, payload),
  onSettled: invalidateEquipment
});

export const deleteEquipmentMutation = mutationOptions({
  mutationFn: (id: number) => deleteEquipment(id),
  onSettled: invalidateEquipment
});
