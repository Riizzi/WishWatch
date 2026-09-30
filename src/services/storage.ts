import { Product, AlertItem, UserSettings, PricePoint } from '../types/index.ts';

const STORAGE_KEYS = {
  PRODUCTS: 'wishwatch_products_v1',
  SETTINGS: 'wishwatch_settings_v1',
  ALERTS: 'wishwatch_alerts_v1',
};

export const DEFAULT_SETTINGS: UserSettings = {
  monthlyIncome: 6000,
  monthlyHours: 160,
  checkIntervalHours: 6,
  dropAlertPercent: 10,
  enableNotifications: false,
};

export interface IProductRepository {
  getAll(): Promise<Product[]>;
  getById(id: string): Promise<Product | null>;
  save(product: Product): Promise<void>;
  update(product: Product): Promise<void>;
  delete(id: string): Promise<void>;
  getSettings(): Promise<UserSettings>;
  saveSettings(settings: UserSettings): Promise<void>;
  getAlerts(): Promise<AlertItem[]>;
  saveAlert(alert: AlertItem): Promise<void>;
  clearAlerts(): Promise<void>;
  loadSampleData(): Promise<void>;
  exportData(): Promise<string>;
  importData(jsonString: string): Promise<boolean>;
  clearAllData(): Promise<void>;
}

class LocalStorageProductRepository implements IProductRepository {
  async getAll(): Promise<Product[]> {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
      if (!data) return [];
      return JSON.parse(data) as Product[];
    } catch {
      return [];
    }
  }

  async getById(id: string): Promise<Product | null> {
    const products = await this.getAll();
    return products.find((p) => p.id === id) || null;
  }

  async save(product: Product): Promise<void> {
    const products = await this.getAll();
    const existingIndex = products.findIndex((p) => p.id === product.id);
    if (existingIndex >= 0) {
      products[existingIndex] = product;
    } else {
      products.unshift(product);
    }
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
  }

  async update(product: Product): Promise<void> {
    return this.save(product);
  }

  async delete(id: string): Promise<void> {
    const products = await this.getAll();
    const filtered = products.filter((p) => p.id !== id);
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(filtered));
  }

  async getSettings(): Promise<UserSettings> {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (!data) return DEFAULT_SETTINGS;
      return { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
    } catch {
      return DEFAULT_SETTINGS;
    }
  }

  async saveSettings(settings: UserSettings): Promise<void> {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  }

  async getAlerts(): Promise<AlertItem[]> {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.ALERTS);
      if (!data) return [];
      return JSON.parse(data) as AlertItem[];
    } catch {
      return [];
    }
  }

  async saveAlert(alert: AlertItem): Promise<void> {
    const alerts = await this.getAlerts();
    alerts.unshift(alert);
    // Guarda até 100 registros históricos de alertas
    localStorage.setItem(STORAGE_KEYS.ALERTS, JSON.stringify(alerts.slice(0, 100)));
  }

  async clearAlerts(): Promise<void> {
    localStorage.removeItem(STORAGE_KEYS.ALERTS);
  }

  async exportData(): Promise<string> {
    const products = await this.getAll();
    const settings = await this.getSettings();
    const alerts = await this.getAlerts();
    return JSON.stringify({ products, settings, alerts, exportedAt: new Date().toISOString() }, null, 2);
  }

  async importData(jsonString: string): Promise<boolean> {
    try {
      const parsed = JSON.parse(jsonString);
      if (Array.isArray(parsed.products)) {
        localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(parsed.products));
      }
      if (parsed.settings) {
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(parsed.settings));
      }
      if (Array.isArray(parsed.alerts)) {
        localStorage.setItem(STORAGE_KEYS.ALERTS, JSON.stringify(parsed.alerts));
      }
      return true;
    } catch {
      return false;
    }
  }

  async clearAllData(): Promise<void> {
    localStorage.removeItem(STORAGE_KEYS.PRODUCTS);
    localStorage.removeItem(STORAGE_KEYS.ALERTS);
  }

  async loadSampleData(): Promise<void> {
    const now = new Date();

    const generateDates = (daysAgo: number) => {
      const d = new Date(now);
      d.setDate(d.getDate() - daysAgo);
      return d.toISOString();
    };

    const sonyHistory: PricePoint[] = [
      { date: generateDates(30), price: 1849.00, inStock: true },
      { date: generateDates(24), price: 1799.00, inStock: true },
      { date: generateDates(18), price: 1749.00, inStock: true },
      { date: generateDates(12), price: 1699.00, inStock: true },
      { date: generateDates(6), price: 1599.00, inStock: true },
      { date: generateDates(1), price: 1489.00, originalPrice: 1849.00, inStock: true },
    ];

    const kindleHistory: PricePoint[] = [
      { date: generateDates(30), price: 699.00, inStock: true },
      { date: generateDates(22), price: 699.00, inStock: true },
      { date: generateDates(15), price: 749.00, inStock: true },
      { date: generateDates(8), price: 749.00, inStock: true },
      { date: generateDates(3), price: 699.00, originalPrice: 849.00, inStock: true }, // Desconto inflado: preço "de" diz 849 mas histórico já esteve em 699
      { date: generateDates(0), price: 699.00, originalPrice: 849.00, inStock: true },
    ];

    const dellHistory: PricePoint[] = [
      { date: generateDates(30), price: 2799.00, inStock: true },
      { date: generateDates(20), price: 2699.00, inStock: true },
      { date: generateDates(14), price: 2549.00, inStock: true },
      { date: generateDates(7), price: 2499.00, inStock: true },
      { date: generateDates(0), price: 2399.00, originalPrice: 2799.00, inStock: true },
    ];

    const sampleProducts: Product[] = [
      {
        id: 'prod-sample-1',
        url: 'https://www.amazon.com.br/dp/B0863TXGM3',
        name: 'Headphone Sony WH-1000XM4 Cancelamento de Ruído Preto',
        reason: 'Fone atual com bateria desgastada para trabalho remoto',
        priority: 'preciso',
        category: 'Eletrônicos',
        store: 'Amazon',
        imageUrl: 'https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=600&auto=format&fit=crop&q=80',
        targetPrice: 1500.00,
        createdAt: generateDates(30),
        status: 'monitorando',
        priceHistory: sonyHistory,
      },
      {
        id: 'prod-sample-2',
        url: 'https://www.amazon.com.br/dp/B08N3TCP2F',
        name: 'Kindle Paperwhite 16 GB Tela de 6.8 Polegadas com Luz Ajustável',
        reason: 'Leitura diária de livros técnicos sem reflexos na vista',
        priority: 'quero',
        category: 'Livros',
        store: 'Amazon',
        imageUrl: 'https://images.unsplash.com/photo-1592496001020-d31bd830651f?w=600&auto=format&fit=crop&q=80',
        targetPrice: 650.00,
        createdAt: generateDates(30),
        status: 'monitorando',
        priceHistory: kindleHistory,
      },
      {
        id: 'prod-sample-3',
        url: 'https://www.kabum.com.br/produto/monitor-dell-27-quad-hd-165hz',
        name: 'Monitor Dell 27 Polegadas Quad HD 165Hz FreeSync Premium',
        reason: 'Segunda tela para produtividade e edição de diagramas',
        priority: 'desejo',
        category: 'Games',
        store: 'Kabum',
        imageUrl: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=600&auto=format&fit=crop&q=80',
        targetPrice: 2100.00,
        createdAt: generateDates(30),
        status: 'monitorando',
        priceHistory: dellHistory,
      },
    ];

    const sampleAlerts: AlertItem[] = [
      {
        id: 'alert-sample-1',
        date: generateDates(1),
        productId: 'prod-sample-1',
        productName: 'Headphone Sony WH-1000XM4 Cancelamento de Ruído Preto',
        event: 'Preço abaixo do alvo',
        value: 1489.00,
        oldValue: 1599.00,
        store: 'Amazon',
      },
      {
        id: 'alert-sample-2',
        date: generateDates(1),
        productId: 'prod-sample-1',
        productName: 'Headphone Sony WH-1000XM4 Cancelamento de Ruído Preto',
        event: 'Menor preço registrado',
        value: 1489.00,
        oldValue: 1599.00,
        store: 'Amazon',
      },
      {
        id: 'alert-sample-3',
        date: generateDates(7),
        productId: 'prod-sample-3',
        productName: 'Monitor Dell 27 Polegadas Quad HD 165Hz FreeSync Premium',
        event: 'Menor preço registrado',
        value: 2399.00,
        oldValue: 2499.00,
        store: 'Kabum',
      },
    ];

    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(sampleProducts));
    localStorage.setItem(STORAGE_KEYS.ALERTS, JSON.stringify(sampleAlerts));
  }
}

export const storage = new LocalStorageProductRepository();
