/**
 * Regras de alerta e aplicação de uma nova leitura de preço.
 * Módulo puro: roda no navegador, no servidor e no job agendado.
 */
import { Product, AlertItem, UserSettings, PriceResult } from '../types/index.ts';
import { formatBRL } from '../utils/formatters.ts';

export function evaluateAlerts(
  product: Product,
  newResult: PriceResult,
  settings: UserSettings
): AlertItem[] {
  const alerts: AlertItem[] = [];
  const now = new Date().toISOString();
  let seq = 0;
  const newId = () => `alert-${Date.now()}-${seq++}-${Math.random().toString(36).substring(2, 6)}`;

  // Leituras incertas (baixa confiança) não disparam alertas
  if (newResult.price === null || newResult.uncertain) return alerts;

  const newPrice = newResult.price;
  const history = product.priceHistory;
  const lastPoint = history.length > 0 ? history[history.length - 1] : null;
  const previousPrice = lastPoint?.price;

  // 1. Alerta: Preço abaixo do alvo
  if (product.targetPrice && newPrice <= product.targetPrice) {
    if (!previousPrice || previousPrice > product.targetPrice) {
      alerts.push({
        id: newId(),
        date: now,
        productId: product.id,
        productName: product.name,
        event: 'Preço abaixo do alvo',
        value: newPrice,
        oldValue: previousPrice,
        store: product.store,
      });
    }
  }

  // 2. Alerta: Queda de X% ou mais desde a última checagem
  if (previousPrice && previousPrice > 0) {
    const dropPercent = ((previousPrice - newPrice) / previousPrice) * 100;
    if (dropPercent >= settings.dropAlertPercent) {
      alerts.push({
        id: newId(),
        date: now,
        productId: product.id,
        productName: product.name,
        event: `Queda de ${Math.round(dropPercent)}% desde a última checagem`,
        value: newPrice,
        oldValue: previousPrice,
        store: product.store,
      });
    }
  }

  // 3. Alerta: Menor preço registrado
  const historicalPrices = history.map((p) => p.price).filter((p) => p > 0);
  if (historicalPrices.length > 0) {
    const historicalMin = Math.min(...historicalPrices);
    if (newPrice < historicalMin) {
      alerts.push({
        id: newId(),
        date: now,
        productId: product.id,
        productName: product.name,
        event: 'Menor preço registrado',
        value: newPrice,
        oldValue: historicalMin,
        store: product.store,
      });
    }
  }

  // 4. Alerta: Produto voltou ao estoque
  if (lastPoint && !lastPoint.inStock && newResult.inStock) {
    alerts.push({
      id: newId(),
      date: now,
      productId: product.id,
      productName: product.name,
      event: 'Produto em estoque',
      value: newPrice,
      store: product.store,
    });
  }

  return alerts;
}

/** Registra a leitura no histórico do produto (sem efeitos colaterais). */
export function applyPriceResult(product: Product, result: PriceResult, now = new Date().toISOString()): Product {
  const priceHistory = [...product.priceHistory];
  if (result.price !== null) {
    priceHistory.push({
      date: now,
      price: result.price,
      originalPrice: result.originalPrice || undefined,
      inStock: result.inStock,
      uncertain: result.uncertain,
    });
  }
  return {
    ...product,
    imageUrl: product.imageUrl || result.imageUrl,
    store: product.store || result.store,
    lastCheckedAt: now,
    lastCheckError: result.price === null ? result.rawText || 'Preço não identificado' : undefined,
    priceHistory,
  };
}

/** Texto da notificação de um alerta, ex.: "R$ 289,90 (-15%) · Preço abaixo do alvo". */
export function alertNotificationBody(alert: AlertItem): string {
  const drop =
    alert.oldValue && alert.oldValue > alert.value
      ? ` (-${Math.round(((alert.oldValue - alert.value) / alert.oldValue) * 100)}%)`
      : '';
  return `${formatBRL(alert.value)}${drop} · ${alert.event}`;
}
