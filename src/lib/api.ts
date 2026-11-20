import { auth } from './firebase.ts';

export async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('Please sign in to continue.');
  }

  const token = await currentUser.getIdToken();
  const headers = new Headers(options.headers || {});
  headers.set('Authorization', `Bearer ${token}`);
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status})`);
  }

  return data as T;
}
