export const INITIAL_USER_PASSWORD = '12341234a';

export function isInitialUserPassword(password: string): boolean {
  return password === INITIAL_USER_PASSWORD;
}
