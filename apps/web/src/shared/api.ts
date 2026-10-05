export class ApiException extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

let accessToken: string | null = sessionStorage.getItem('eq_access');
let refreshing: Promise<string | null> | null = null;

export function setToken(token: string | null) {
  accessToken = token;
  if (token) sessionStorage.setItem('eq_access', token);
  else sessionStorage.removeItem('eq_access');
}

export function getToken() {
  return accessToken;
}

async function refresh(): Promise<string | null> {
  if (!refreshing) {
    refreshing = fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) return null;
        const data = await res.json();
        setToken(data.accessToken);
        return data.accessToken as string;
      })
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

export async function api<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  const res = await fetch(path, { ...init, headers, credentials: 'include' });
  if (res.status === 401 && retry && !path.startsWith('/api/auth/login') && !path.startsWith('/api/auth/refresh')) {
    const token = await refresh();
    if (token) return api<T>(path, init, false);
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new ApiException(data?.error?.code ?? 'HTTP', data?.error?.message ?? 'No se pudo completar la acción');
  }
  return data as T;
}

export async function download(path: string, filename: string) {
  const headers = new Headers();
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  const res = await fetch(path, { headers, credentials: 'include' });
  if (!res.ok) throw new ApiException('DOWNLOAD', 'No se pudo descargar el reporte');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
