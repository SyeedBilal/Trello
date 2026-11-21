const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api';

export interface ApiError {
  success: false;
  message: string;
}

export class ApiRequestError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
  }
}

type AccessTokenRefresher = () => Promise<string>;

let accessTokenRefresher: AccessTokenRefresher | undefined;

export function registerAccessTokenRefresher(refresher: AccessTokenRefresher) {
  accessTokenRefresher = refresher;
  return () => {
    if (accessTokenRefresher === refresher) accessTokenRefresher = undefined;
  };
}

export async function apiRequest<T>(path: string, options: RequestInit = {}, accessToken?: string): Promise<T> {
  const send = (token?: string) => fetch(`${API_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  let response = await send(accessToken);
  const refresh = accessTokenRefresher;
  if (response.status === 401 && accessToken && refresh && !path.startsWith('/auth/')) {
    response = await send(await refresh());
  }

  const body = await response.json().catch(() => ({ success: false, message: 'Unexpected server response' })) as T | ApiError;
  if (!response.ok) {
    throw new ApiRequestError((body as ApiError).message ?? 'Request failed', response.status);
  }
  return body as T;
}
