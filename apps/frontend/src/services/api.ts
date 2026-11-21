const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api';

export interface ApiError {
  success: false;
  message: string;
}

export async function apiRequest<T>(path: string, options: RequestInit = {}, accessToken?: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...options.headers,
    },
  });
  const body = await response.json().catch(() => ({ success: false, message: 'Unexpected server response' })) as T | ApiError;
  if (!response.ok) throw new Error((body as ApiError).message);
  return body as T;
}
