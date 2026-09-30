/** Inscrição de Web Push deste aparelho. */
import { pushApi } from './apiClient.ts';

export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function registration() {
  const reg = await navigator.serviceWorker.getRegistration();
  return reg ?? navigator.serviceWorker.ready;
}

export async function getPushSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;
  try {
    return await (await registration()).pushManager.getSubscription();
  } catch {
    return null;
  }
}

/** Pede permissão, inscreve o aparelho e registra no servidor. */
export async function enablePush(): Promise<void> {
  if (!isPushSupported()) throw new Error('Este navegador não recebe notificações push');

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Permissão de notificação negada');

  const { publicKey } = await pushApi.publicKey();
  const reg = await registration();
  const existing = await reg.pushManager.getSubscription();

  // Se a chave do servidor mudou, a inscrição antiga não serve mais
  const existingKey = existing?.options.applicationServerKey;
  const sameKey =
    existingKey && btoa(String.fromCharCode(...new Uint8Array(existingKey))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') === publicKey;
  if (existing && !sameKey) await existing.unsubscribe();

  const subscription =
    (sameKey && existing) ||
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    }));

  await pushApi.subscribe(subscription.toJSON());
}

export async function disablePush(): Promise<void> {
  const sub = await getPushSubscription();
  if (!sub) return;
  await pushApi.unsubscribe(sub.endpoint).catch(() => undefined);
  await sub.unsubscribe();
}

export function sendTestPush() {
  return pushApi.test();
}
