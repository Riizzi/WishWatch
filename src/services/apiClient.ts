import {
  AIAnalysisResult,
  AlertItem,
  AppState,
  PriceResult,
  Product,
  ServerHealth,
  UserSettings,
} from '../types/index.ts';

const ACCESS_KEY_STORAGE = 'wishwatch_access_key';

export class AuthError extends Error {
  constructor() {
    super('Chave de acesso inválida');
    this.name = 'AuthError';
  }
}

export function getAccessKey(): string {
  try {
    return localStorage.getItem(ACCESS_KEY_STORAGE) || '';
  } catch {
    return '';
  }
}

export function setAccessKey(key: string) {
  try {
    if (key) localStorage.setItem(ACCESS_KEY_STORAGE, key);
    else localStorage.removeItem(ACCESS_KEY_STORAGE);
  } catch {
    // armazenamento indisponível (modo privado)
  }
}

async function apiFetch<T>(path: string, init: RequestInit = {}, key = getAccessKey()): Promise<T> {
  const headers: Record<string, string> = { ...(init.headers as Record<string, string>) };
  if (init.body) headers['Content-Type'] = 'application/json';
  if (key) headers.Authorization = `Bearer ${key}`;

  const response = await fetch(`/api${path}`, { ...init, headers });
  if (response.status === 401) throw new AuthError();
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Falha na comunicação com o servidor');
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

const json = (body: unknown): RequestInit => ({ body: JSON.stringify(body) });

// --- Servidor ---
export async function fetchHealth(): Promise<ServerHealth | null> {
  try {
    const res = await fetch('/api/health');
    if (!res.ok) return null;
    return (await res.json()) as ServerHealth;
  } catch {
    return null;
  }
}

/** Testa uma chave de acesso sem salvá-la. */
export async function verifyAccessKey(key: string): Promise<boolean> {
  try {
    await apiFetch('/state', {}, key);
    return true;
  } catch (err) {
    if (err instanceof AuthError) return false;
    throw err;
  }
}

// --- IA ---
export function fetchPriceCheck(url: string): Promise<PriceResult> {
  return apiFetch('/check-price', { method: 'POST', ...json({ url }) });
}

export function fetchPurchaseAnalysis(product: Product, settings: UserSettings): Promise<AIAnalysisResult> {
  return apiFetch('/analyze-purchase', { method: 'POST', ...json({ product, settings }) });
}

// --- Dados sincronizados ---
export const remoteApi = {
  getState: () => apiFetch<AppState>('/state'),
  saveProduct: (p: Product) => apiFetch<Product>(`/products/${encodeURIComponent(p.id)}`, { method: 'PUT', ...json(p) }),
  deleteProduct: (id: string) => apiFetch<void>(`/products/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  saveSettings: (s: UserSettings) => apiFetch<UserSettings>('/settings', { method: 'PUT', ...json(s) }),
  addAlert: (a: AlertItem) => apiFetch<AlertItem>('/alerts', { method: 'POST', ...json(a) }),
  clearAlerts: () => apiFetch<void>('/alerts', { method: 'DELETE' }),
  importState: (state: Partial<AppState>) => apiFetch<AppState>('/import', { method: 'POST', ...json(state) }),
  clearData: () => apiFetch<void>('/data', { method: 'DELETE' }),
};

/** Verificação feita no servidor: grava histórico, alertas e envia push. */
export function serverCheckProduct(id: string): Promise<{ product: Product; alerts: AlertItem[] }> {
  return apiFetch(`/products/${encodeURIComponent(id)}/check`, { method: 'POST' });
}

// --- Push ---
export const pushApi = {
  publicKey: () => apiFetch<{ publicKey: string }>('/push/public-key'),
  subscribe: (subscription: PushSubscriptionJSON) =>
    apiFetch<void>('/push/subscribe', { method: 'POST', ...json({ subscription }) }),
  unsubscribe: (endpoint: string) => apiFetch<void>('/push/unsubscribe', { method: 'POST', ...json({ endpoint }) }),
  test: () => apiFetch<{ sent: number; total: number }>('/push/test', { method: 'POST' }),
};
