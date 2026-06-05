/**
 * Supabase public env (browser + server).
 * NEXT_PUBLIC_* must be referenced literally for Next.js client bundling.
 */

function cleanEnvValue(value: string | undefined): string {
  if (!value) {
    return '';
  }

  const trimmed = value.trim();

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }

  return trimmed;
}

export function getSupabaseUrl(): string {
  const url = cleanEnvValue(process.env.NEXT_PUBLIC_SUPABASE_URL);

  if (!url) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL. Add it to .env and restart `npm run dev`.'
    );
  }

  return url;
}

export function getSupabasePublishableKey(): string {
  const publishable = cleanEnvValue(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  const anon = cleanEnvValue(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const key = publishable || anon;

  if (!key || key === 'undefined' || key === 'null') {
    throw new Error(
      'Missing Supabase API key. Set NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or legacy NEXT_PUBLIC_SUPABASE_ANON_KEY) in .env and restart `npm run dev`.'
    );
  }

  return key;
}
