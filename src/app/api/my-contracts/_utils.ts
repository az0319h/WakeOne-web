import { parseContractId } from '@/app/api/contracts/_utils';

export { parseContractId };

export function parseMyContractAttachmentId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export function getSingleSearchParam(searchParams: URLSearchParams, key: string): string | undefined {
  const values = searchParams.getAll(key).map((value) => value.trim()).filter(Boolean);
  return values.at(-1);
}
