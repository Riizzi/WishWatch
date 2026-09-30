/**
 * Web Push. As chaves VAPID são geradas no primeiro uso e guardadas no banco,
 * então não precisam ser configuradas manualmente. Se VAPID_PUBLIC_KEY e
 * VAPID_PRIVATE_KEY estiverem definidas no ambiente, elas têm prioridade.
 */
import webpush from 'web-push';
import type { WishWatchRepo, VapidKeys } from './repo.ts';

const SUBJECT = process.env.VAPID_SUBJECT || 'https://github.com/Riizzi/WishWatch';

export interface PushPayload {
  title: string;
  body: string;
  tag?: string;
  url?: string;
}

async function ensureVapid(repo: WishWatchRepo): Promise<VapidKeys> {
  const fromEnv = process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY;
  if (fromEnv) {
    return { publicKey: process.env.VAPID_PUBLIC_KEY!, privateKey: process.env.VAPID_PRIVATE_KEY! };
  }
  let keys = await repo.getVapidKeys();
  if (!keys) {
    keys = webpush.generateVAPIDKeys();
    await repo.saveVapidKeys(keys);
  }
  return keys;
}

export async function getPublicKey(repo: WishWatchRepo): Promise<string> {
  return (await ensureVapid(repo)).publicKey;
}

/** Envia para todos os aparelhos inscritos. Remove inscrições expiradas. */
export async function sendPushToAll(repo: WishWatchRepo, payload: PushPayload) {
  const keys = await ensureVapid(repo);
  const subs = await repo.getSubscriptions();
  let sent = 0;
  let removed = 0;

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: sub.keys },
        JSON.stringify(payload),
        { vapidDetails: { subject: SUBJECT, ...keys }, TTL: 60 * 60 * 24, urgency: 'high' }
      );
      sent++;
    } catch (err: any) {
      if (err?.statusCode === 404 || err?.statusCode === 410) {
        await repo.deleteSubscription(sub.endpoint);
        removed++;
      } else {
        console.error('Falha ao enviar push:', err?.statusCode || err?.message || err);
      }
    }
  }
  return { sent, removed, total: subs.length };
}
