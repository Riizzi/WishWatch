/** Acesso aos dados do WishWatch no servidor (produtos, configurações, alertas, push). */
import type { KeyValueStore } from './db.ts';
import type { AlertItem, AppState, Product, UserSettings } from '../src/types/index.ts';

const K = {
  products: 'ww:products',
  settings: 'ww:settings',
  alerts: 'ww:alerts',
  push: 'ww:push',
  vapid: 'ww:vapid',
};

export const DEFAULT_SETTINGS: UserSettings = {
  monthlyIncome: 6000,
  monthlyHours: 160,
  checkIntervalHours: 6,
  dropAlertPercent: 10,
  enableNotifications: false,
};

const MAX_ALERTS = 100;

export interface StoredSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  createdAt: string;
  userAgent?: string;
}

export interface VapidKeys {
  publicKey: string;
  privateKey: string;
}

function parse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export class WishWatchRepo {
  constructor(private store: KeyValueStore) {}

  get kind() {
    return this.store.kind;
  }

  async getProducts(): Promise<Product[]> {
    const all = await this.store.hgetall(K.products);
    return Object.values(all)
      .map((v) => parse<Product | null>(v, null))
      .filter((p): p is Product => !!p)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async getProduct(id: string): Promise<Product | null> {
    const all = await this.store.hgetall(K.products);
    return parse<Product | null>(all[id], null);
  }

  async saveProduct(product: Product) {
    await this.store.hset(K.products, product.id, JSON.stringify(product));
  }

  async deleteProduct(id: string) {
    await this.store.hdel(K.products, id);
  }

  async getSettings(): Promise<UserSettings> {
    return { ...DEFAULT_SETTINGS, ...parse<Partial<UserSettings>>(await this.store.get(K.settings), {}) };
  }

  async saveSettings(settings: UserSettings) {
    await this.store.set(K.settings, JSON.stringify(settings));
  }

  async getAlerts(): Promise<AlertItem[]> {
    return parse<AlertItem[]>(await this.store.get(K.alerts), []);
  }

  async addAlerts(alerts: AlertItem[]) {
    if (!alerts.length) return;
    const current = await this.getAlerts();
    await this.store.set(K.alerts, JSON.stringify([...alerts, ...current].slice(0, MAX_ALERTS)));
  }

  async clearAlerts() {
    await this.store.del(K.alerts);
  }

  async getState(): Promise<AppState> {
    const [products, settings, alerts] = await Promise.all([
      this.getProducts(),
      this.getSettings(),
      this.getAlerts(),
    ]);
    return { products, settings, alerts };
  }

  /** Substitui produtos e alertas (importação / migração do modo local). */
  async replaceAll(state: Partial<AppState>) {
    if (Array.isArray(state.products)) {
      await this.store.del(K.products);
      for (const p of state.products) await this.saveProduct(p);
    }
    if (state.settings) await this.saveSettings({ ...DEFAULT_SETTINGS, ...state.settings });
    if (Array.isArray(state.alerts)) {
      await this.store.set(K.alerts, JSON.stringify(state.alerts.slice(0, MAX_ALERTS)));
    }
  }

  async clearProductsAndAlerts() {
    await this.store.del(K.products);
    await this.store.del(K.alerts);
  }

  // --- Push ---
  async getSubscriptions(): Promise<StoredSubscription[]> {
    const all = await this.store.hgetall(K.push);
    return Object.values(all)
      .map((v) => parse<StoredSubscription | null>(v, null))
      .filter((s): s is StoredSubscription => !!s);
  }

  async saveSubscription(sub: StoredSubscription) {
    await this.store.hset(K.push, subscriptionId(sub.endpoint), JSON.stringify(sub));
  }

  async deleteSubscription(endpoint: string) {
    await this.store.hdel(K.push, subscriptionId(endpoint));
  }

  async getVapidKeys(): Promise<VapidKeys | null> {
    return parse<VapidKeys | null>(await this.store.get(K.vapid), null);
  }

  async saveVapidKeys(keys: VapidKeys) {
    await this.store.set(K.vapid, JSON.stringify(keys));
  }
}

/** Identificador curto e estável para um endpoint de push. */
function subscriptionId(endpoint: string): string {
  let h = 5381;
  for (let i = 0; i < endpoint.length; i++) h = ((h << 5) + h + endpoint.charCodeAt(i)) >>> 0;
  return `${h.toString(36)}-${endpoint.length}`;
}
