function resolveApiUrl(endpoint: string): string {
  return endpoint.startsWith('/api')
    ? endpoint
    : `/api${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
}

function createRequestInit(options?: RequestInit): RequestInit {
  const headers = new Headers(options?.headers);
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  return { ...options, headers };
}

export async function apiClient<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const res = await fetch(resolveApiUrl(endpoint), createRequestInit(options));

  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }

  return res.json() as Promise<T>;
}

export async function apiClientWithMessage<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(resolveApiUrl(endpoint), createRequestInit(options));

  const data = (await res.json()) as T & { message?: string };

  if (!res.ok) {
    throw new Error(
      typeof data === 'object' && data !== null && 'message' in data && data.message
        ? String(data.message)
        : `API error: ${res.status}`
    );
  }

  return data;
}
