export type Priority = 'preciso' | 'quero' | 'desejo';
export type ProductStatus = 'monitorando' | 'comprado' | 'arquivado';

export interface PricePoint {
  date: string;
  price: number;
  originalPrice?: number;
  inStock: boolean;
  uncertain?: boolean;
}

export interface Product {
  id: string;
  url: string;
  name: string;
  reason: string;
  priority: Priority;
  category: string;
  store: string;
  imageUrl?: string;
  targetPrice?: number;
  createdAt: string;
  status: ProductStatus;
  paidPrice?: number;
  priceHistory: PricePoint[];
}

export interface PriceResult {
  name: string;
  price: number | null;
  originalPrice?: number | null;
  currency: string;
  store: string;
  imageUrl?: string;
  inStock: boolean;
  confidence: number;
  category?: string;
  uncertain: boolean;
  rawText?: string;
}

export interface AlertItem {
  id: string;
  date: string;
  productId: string;
  productName: string;
  event: string; // Ex: "Preço abaixo do alvo", "Queda de 12%", "Menor preço registrado", "Produto em estoque"
  value: number;
  oldValue?: number;
  store?: string;
}

export interface UserSettings {
  monthlyIncome: number; // R$ renda mensal
  monthlyHours: number;  // horas trabalhadas por mês
  checkIntervalHours: number; // Intervalo de rechecagem em horas
  dropAlertPercent: number;   // % de queda para alerta (ex: 10)
  enableNotifications: boolean;
  lastCheckedAt?: string;
}

export interface AIAnalysisResult {
  recommendation: 'Comprar agora' | 'Aguardar';
  justification: string;
  assessedAt: string;
}
