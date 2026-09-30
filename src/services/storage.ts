import { Product, AlertItem, UserSettings, AppState } from '../types/index.ts';
import { remoteApi } from './apiClient.ts';
import { buildSampleData } from './sampleData.ts';

const STORAGE_KEYS = {
  PRODUCTS: 'wishwatch_products_v1',
  SETTINGS: 'wishwatch_settings_v1',
  ALERTS: 'wishwatch_alerts_v1',
  REMOTE_CACHE: 'wishwatch_remote_cache_v1',
};

export const DEFAULT_SETTINGS: UserSettings = {
  monthlyIncome: 6000,
  monthlyHours: 160,
  checkIntervalHours: 6,
  dropAlertPercent: 10,
  enableNotifications: false,
};

export interface IProductRepository {
  getState(): Promise<AppState>;
  save(product: Product): Promise<void>;
  update(product: Product): Promise<void>;
  delete(id: string): Promise<void>;
  saveSettings(settings: UserSettings): Promise<void>;
  saveAlert(alert: AlertItem): Promise<void>;
  clearAlerts(): Promise<void>;
  loadSampleData(): Promise<void>;
  exportData(): Promise<string>;
  importData(jsonString: string): Promise<boolean>;
  clearAllData(): Promise<void>;
}

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn('Não foi possível salvar no armazenamento local:', err);
  }
}

function parseImport(jsonString: string): Partial<AppState> | null {
  try {
    const parsed = JSON.parse(jsonString);
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      products: Array.isArray(parsed.products) ? parsed.products : undefined,
      settings: parsed.settings && typeof parsed.settings === 'object' ? parsed.settings : undefined,
      alerts: Array.isArray(parsed.alerts) ? parsed.alerts : undefined,
    };
  } catch {
    return null;
  }
}

function exportJSON(state: AppState) {
  return JSON.stringify({ ...state, exportedAt: new Date().toISOString() }, null, 2);
}

/** Modo local: tudo fica no navegador deste aparelho. */
class LocalRepository implements IProductRepository {
  async getState(): Promise<AppState> {
    return {
      products: readJSON<Product[]>(STORAGE_KEYS.PRODUCTS, []),
      settings: { ...DEFAULT_SETTINGS, ...readJSON<Partial<UserSettings>>(STORAGE_KEYS.SETTINGS, {}) },
      alerts: readJSON<AlertItem[]>(STORAGE_KEYS.ALERTS, []),
    };
  }

  async save(product: Product) {
    const products = readJSON<Product[]>(STORAGE_KEYS.PRODUCTS, []);
    const i = products.findIndex((p) => p.id === product.id);
    if (i >= 0) products[i] = product;
    else products.unshift(product);
    writeJSON(STORAGE_KEYS.PRODUCTS, products);
  }

  update(product: Product) {
    return this.save(product);
  }

  async delete(id: string) {
    writeJSON(STORAGE_KEYS.PRODUCTS, readJSON<Product[]>(STORAGE_KEYS.PRODUCTS, []).filter((p) => p.id !== id));
  }

  async saveSettings(settings: UserSettings) {
    writeJSON(STORAGE_KEYS.SETTINGS, settings);
  }

  async saveAlert(alert: AlertItem) {
    const alerts = readJSON<AlertItem[]>(STORAGE_KEYS.ALERTS, []);
    writeJSON(STORAGE_KEYS.ALERTS, [alert, ...alerts].slice(0, 100));
  }

  async clearAlerts() {
    localStorage.removeItem(STORAGE_KEYS.ALERTS);
  }

  async loadSampleData() {
    const { products, alerts } = buildSampleData();
    writeJSON(STORAGE_KEYS.PRODUCTS, products);
    writeJSON(STORAGE_KEYS.ALERTS, alerts);
  }

  async exportData() {
    return exportJSON(await this.getState());
  }

  async importData(jsonString: string) {
    const state = parseImport(jsonString);
    if (!state) return false;
    if (state.products) writeJSON(STORAGE_KEYS.PRODUCTS, state.products);
    if (state.settings) writeJSON(STORAGE_KEYS.SETTINGS, state.settings);
    if (state.alerts) writeJSON(STORAGE_KEYS.ALERTS, state.alerts);
    return true;
  }

  async clearAllData() {
    localStorage.removeItem(STORAGE_KEYS.PRODUCTS);
    localStorage.removeItem(STORAGE_KEYS.ALERTS);
  }
}

/**
 * Modo sincronizado: os dados ficam no servidor (Upstash Redis), onde o
 * monitoramento 24/7 também os lê. Guarda uma cópia local para abrir offline.
 */
class RemoteRepository implements IProductRepository {
  async getState(): Promise<AppState> {
    try {
      const state = await remoteApi.getState();
      writeJSON(STORAGE_KEYS.REMOTE_CACHE, state);
      return state;
    } catch (err) {
      const cached = readJSON<AppState | null>(STORAGE_KEYS.REMOTE_CACHE, null);
      if (cached && !navigator.onLine) return cached;
      throw err;
    }
  }

  async save(product: Product) {
    await remoteApi.saveProduct(product);
  }

  update(product: Product) {
    return this.save(product);
  }

  async delete(id: string) {
    await remoteApi.deleteProduct(id);
  }

  async saveSettings(settings: UserSettings) {
    await remoteApi.saveSettings(settings);
  }

  async saveAlert(alert: AlertItem) {
    await remoteApi.addAlert(alert);
  }

  async clearAlerts() {
    await remoteApi.clearAlerts();
  }

  async loadSampleData() {
    await remoteApi.importState(buildSampleData());
  }

  async exportData() {
    return exportJSON(await this.getState());
  }

  async importData(jsonString: string) {
    const state = parseImport(jsonString);
    if (!state) return false;
    await remoteApi.importState(state);
    return true;
  }

  async clearAllData() {
    await remoteApi.clearData();
  }
}

/** Fachada usada pelo app; alterna entre o modo local e o sincronizado. */
class StorageFacade implements IProductRepository {
  readonly local = new LocalRepository();
  private readonly remote = new RemoteRepository();
  private mode: 'local' | 'remote' = 'local';

  setRemote(enabled: boolean) {
    this.mode = enabled ? 'remote' : 'local';
  }

  isRemote() {
    return this.mode === 'remote';
  }

  private get impl(): IProductRepository {
    return this.mode === 'remote' ? this.remote : this.local;
  }

  getState() { return this.impl.getState(); }
  save(p: Product) { return this.impl.save(p); }
  update(p: Product) { return this.impl.update(p); }
  delete(id: string) { return this.impl.delete(id); }
  saveSettings(s: UserSettings) { return this.impl.saveSettings(s); }
  saveAlert(a: AlertItem) { return this.impl.saveAlert(a); }
  clearAlerts() { return this.impl.clearAlerts(); }
  loadSampleData() { return this.impl.loadSampleData(); }
  exportData() { return this.impl.exportData(); }
  importData(json: string) { return this.impl.importData(json); }
  clearAllData() { return this.impl.clearAllData(); }
}

export const storage = new StorageFacade();
