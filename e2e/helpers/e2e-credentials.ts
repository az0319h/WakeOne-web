export const INITIAL_USER_PASSWORD = '12341234a';

/** E2E fixture accounts must not use the initial password (plan 44 force-change). */
export const E2E_FIXTURE_PASSWORD = 'E2eFixt9!';

export function resolveE2EPassword(envPassword: string | undefined): string {
  if (!envPassword || envPassword === INITIAL_USER_PASSWORD) {
    return E2E_FIXTURE_PASSWORD;
  }

  return envPassword;
}
