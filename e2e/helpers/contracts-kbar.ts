import { expect, type APIRequestContext } from '@playwright/test';

export type ExistingContractSeed = {
  document_number: string;
  author_name: string;
  contract_target: string;
};

/**
 * Read-only: fetch an existing contract for kbar E2E.
 * NEVER call POST /api/contracts/import in kbar specs — it writes to the live DB.
 */
export async function requireExistingContract(
  request: APIRequestContext,
  search?: string
): Promise<ExistingContractSeed> {
  const query = search
    ? `/api/contracts?search=${encodeURIComponent(search)}&limit=1&page=1`
    : '/api/contracts?limit=1&page=1';

  const response = await request.get(query);
  expect(response.status()).toBe(200);

  const body = await response.json();
  const contract = body.items?.[0] as ExistingContractSeed | undefined;

  expect(
    contract,
    search
      ? `kbar E2E: search="${search}" 로 조회 가능한 기존 계약이 필요합니다. import API로 시드하지 마세요.`
      : 'kbar E2E: 목록에 기존 계약 1건 이상 필요합니다. import API로 시드하지 마세요.'
  ).toBeTruthy();

  expect(contract!.document_number).toBeTruthy();
  expect(contract!.author_name).toBeTruthy();
  expect(contract!.contract_target).toBeTruthy();

  return contract!;
}
