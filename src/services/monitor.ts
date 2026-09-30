import { Product, AlertItem, UserSettings, PriceResult } from '../types/index.ts';
import { storage } from './storage.ts';
import { fetchPriceCheck } from './apiClient.ts';
import { formatBRL } from '../utils/formatters.ts';

// Helper for delays between queue items
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission !== 'denied') {
    const res = await Notification.requestPermission();
    return res === 'granted';
  }
  return false;
}

/**
 * Envia a notificação pelo service worker quando possível. No Android, o
 * construtor `new Notification()` não funciona; só `registration.showNotification`.
 */
export async function sendBrowserNotification(title: string, body: string, tag?: string) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  const options: NotificationOptions = {
    body,
    tag,
    icon: '/notification-icon.png',
    badge: '/pwa-monochrome-512x512.png',
  };

  try {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        await registration.showNotification(title, options);
        return;
      }
    }
    new Notification(title, options);
  } catch (err) {
    console.warn('Não foi possível exibir a notificação:', err);
  }
}

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

export async function checkSingleProduct(
  product: Product,
  settings: UserSettings
): Promise<{ product: Product; alerts: AlertItem[] }> {
  const result = await fetchPriceCheck(product.url);

  const updatedHistory = [...product.priceHistory];
  if (result.price !== null) {
    updatedHistory.push({
      date: new Date().toISOString(),
      price: result.price,
      originalPrice: result.originalPrice || undefined,
      inStock: result.inStock,
      uncertain: result.uncertain,
    });
  }

  const updatedProduct: Product = {
    ...product,
    imageUrl: result.imageUrl || product.imageUrl,
    store: result.store || product.store,
    priceHistory: updatedHistory,
  };

  const triggeredAlerts = evaluateAlerts(product, result, settings);

  for (const alert of triggeredAlerts) {
    await storage.saveAlert(alert);
    if (settings.enableNotifications) {
      const dropText = alert.oldValue && alert.oldValue > alert.value
        ? ` (-${Math.round(((alert.oldValue - alert.value) / alert.oldValue) * 100)}%)`
        : '';
      await sendBrowserNotification(
        alert.productName,
        `${formatBRL(alert.value)}${dropText} · ${alert.event}`,
        `${product.id}-${alert.event}`
      );
    }
  }

  await storage.update(updatedProduct);
  return { product: updatedProduct, alerts: triggeredAlerts };
}
