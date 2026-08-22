import { isNative, sharePdf } from '../lib/native';

const TOKEN_KEY = 'petguardian_token';

// Empty on web (same-origin, Vite proxy / Express serves both). On the native
// iOS build, set VITE_API_BASE_URL to the hosted API, e.g.
// https://petguardian-XXXX.onrender.com, so the bundled app reaches the server.
export const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}
export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  details?: unknown;
  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${API_BASE}/api${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new ApiError(res.status, data?.error ?? 'Request failed', data?.details);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  del: <T>(path: string, body?: unknown) => request<T>('DELETE', path, body),
};

export function documentUrl(planId: string, type: string): string {
  return `${API_BASE}/api/plans/${planId}/documents/${type}`;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/**
 * Fetch a protected PDF (auth header required). On the iOS app, hand it to the
 * native share sheet (Save to Files, print, AirDrop, Mail). On the web, trigger
 * a normal browser download.
 */
export async function downloadDocument(planId: string, type: string, filename: string): Promise<void> {
  const res = await fetch(documentUrl(planId, type), {
    headers: getToken() ? { Authorization: `Bearer ${getToken()}` } : {},
  });
  if (!res.ok) throw new ApiError(res.status, 'Could not generate document');
  const buffer = await res.arrayBuffer();

  if (isNative()) {
    const shared = await sharePdf(filename, arrayBufferToBase64(buffer), filename);
    if (shared) return;
  }

  const url = URL.createObjectURL(new Blob([buffer], { type: 'application/pdf' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
