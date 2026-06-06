// Tiny fetch wrapper for the Heuristic API.
// Stores the JWT in localStorage for v0.1. (We'll move to httpOnly cookies in v0.2.)

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('heuristic_token');
}

export function setToken(token: string) {
  localStorage.setItem('heuristic_token', token);
}

export function clearToken() {
  localStorage.removeItem('heuristic_token');
}

export async function api<T = any>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${res.status}: ${body}`);
  }
  return res.status === 204 ? (null as T) : ((await res.json()) as T);
}
