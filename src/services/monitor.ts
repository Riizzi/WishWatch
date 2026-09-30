import { Product, AlertItem, UserSettings } from '../types/index.ts';
import { storage } from './storage.ts';
import { fetchPriceCheck, serverCheckProduct } from './apiClient.ts';
import { evaluateAlerts, applyPriceResult, alertNotificationBody } from './alerts.ts';

export { evaluateAlerts };

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

export async function checkSingleProduct(
  product: Product,
  settings: UserSettings
): Promise<{ product: Product; alerts: AlertItem[] }> {
  // Modo sincronizado: o servidor verifica, salva e envia o push
  if (storage.isRemote()) {
    return serverCheckProduct(product.id);
  }

  const result = await fetchPriceCheck(product.url);
  const updatedProduct = applyPriceResult(product, result);
  const triggeredAlerts = evaluateAlerts(product, result, settings);

  for (const alert of triggeredAlerts) {
    await storage.saveAlert(alert);
    if (settings.enableNotifications) {
      await sendBrowserNotification(alert.productName, alertNotificationBody(alert), `${product.id}-${alert.event}`);
    }
  }

  await storage.update(updatedProduct);
  return { product: updatedProduct, alerts: triggeredAlerts };
}
