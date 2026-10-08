/**
 * Server-side WakeOne environment gate.
 * Dev-only user provisioning requires WAKEONE_ENV=development.
 */
export function isDevUserProvisioningEnabled(): boolean {
  return process.env.WAKEONE_ENV === 'development';
}

/**
 * Client-side CTA visibility (UI only — API gate is isDevUserProvisioningEnabled).
 */
export function isDevUserProvisioningUiEnabled(): boolean {
  return process.env.NEXT_PUBLIC_WAKEONE_ENV === 'development';
}
