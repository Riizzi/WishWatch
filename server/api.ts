/** Rotas /api do WishWatch. */
import express, { NextFunction, Request, Response, Router } from 'express';
import crypto from 'crypto';
import { checkPrice } from '../src/services/priceChecker.ts';
import { analyzePurchase } from '../src/services/purchaseAnalyzer.ts';
import { evaluateAlerts, applyPriceResult, alertNotificationBody } from '../src/services/alerts.ts';
import type { AlertItem, Product } from '../src/types/index.ts';
import { WishWatchRepo, DEFAULT_SETTINGS } from './repo.ts';
import { getPublicKey, sendPushToAll } from './push.ts';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function safeEqual(a: string, b: string) {
  const ha = crypto.createHash('sha256').update(a).digest();
  const hb = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

/** Verifica um produto, grava o histórico, registra alertas e envia push. */
export async function checkAndRecord(repo: WishWatchRepo, product: Product) {
  const settings = await repo.getSettings();
  const result = await checkPrice(product.url);
  const updated = applyPriceResult(product, result);
  const alerts = evaluateAlerts(product, result, settings);

  await repo.saveProduct(updated);
  await repo.addAlerts(alerts);

  if (alerts.length) {
    await notify(repo, product, alerts);
  }
  return { product: updated, alerts };
}

async function notify(repo: WishWatchRepo, product: Product, alerts: AlertItem[]) {
  const [first, ...rest] = alerts;
  const extra = rest.length ? ` · ${rest.map((a) => a.event).join(' · ')}` : '';
  try {
    await sendPushToAll(repo, {
      title: product.name,
      body: alertNotificationBody(first) + extra,
      tag: `product-${product.id}`,
      url: `/?product=${encodeURIComponent(product.id)}`,
    });
  } catch (err) {
    console.error('Erro ao enviar notificações:', err);
  }
}

/** Verifica todos os produtos monitorados, um por vez. Usado pelo cron. */
export async function checkAll(repo: WishWatchRepo, delayMs = 2000) {
  const products = (await repo.getProducts()).filter((p) => p.status === 'monitorando');
  const summary = { checked: 0, failed: 0, alerts: 0, items: [] as { name: string; price: number | null; alerts: string[] }[] };

  for (let i = 0; i < products.length; i++) {
    try {
      const { product, alerts } = await checkAndRecord(repo, products[i]);
      const last = product.lastCheckError ? null : product.priceHistory[product.priceHistory.length - 1]?.price ?? null;
      summary.checked++;
      summary.alerts += alerts.length;
      if (last === null) summary.failed++;
      summary.items.push({ name: product.name, price: last, alerts: alerts.map((a) => a.event) });
    } catch (err) {
      summary.failed++;
      console.error(`Erro ao verificar ${products[i].id}:`, err);
    }
    if (i < products.length - 1) await wait(delayMs);
  }

  const settings = await repo.getSettings();
  await repo.saveSettings({ ...settings, lastCheckedAt: new Date().toISOString() });
  return summary;
}

export function createApiRouter(repo: WishWatchRepo): Router {
  const router = express.Router();
  const accessKey = process.env.APP_ACCESS_KEY?.trim() || '';
  const sync = repo.kind === 'upstash';

  router.get('/health', (_req, res) => {
    res.json({ ok: true, gemini: Boolean(process.env.GEMINI_API_KEY), sync, auth: Boolean(accessKey), push: sync });
  });

  // Chave de acesso (quando configurada) protege os dados e a cota do Gemini
  router.use((req: Request, res: Response, next: NextFunction) => {
    if (!accessKey) return next();
    const header = req.get('authorization') || '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (token && safeEqual(token, accessKey)) return next();
    res.status(401).json({ error: 'Chave de acesso inválida' });
  });

  const handle =
    (fn: (req: Request, res: Response) => Promise<unknown>) => (req: Request, res: Response) =>
      fn(req, res).catch((err: any) => {
        console.error(`Erro em ${req.method} ${req.originalUrl}:`, err);
        res.status(500).json({ error: err?.message || 'Erro interno' });
      });

  // --- Leitura de preço (prévia do cadastro) e análise ---
  router.post('/check-price', handle(async (req, res) => {
    const { url } = req.body || {};
    if (!url || typeof url !== 'string') return res.status(400).json({ error: 'Link do produto é obrigatório' });
    res.json(await checkPrice(url));
  }));

  router.post('/analyze-purchase', handle(async (req, res) => {
    const { product, settings } = req.body || {};
    if (!product) return res.status(400).json({ error: 'Dados do produto são obrigatórios' });
    res.json(await analyzePurchase(product, settings || DEFAULT_SETTINGS));
  }));

  // --- Dados sincronizados ---
  router.get('/state', handle(async (_req, res) => res.json(await repo.getState())));

  router.put('/products/:id', handle(async (req, res) => {
    const product = req.body as Product;
    if (!product || product.id !== req.params.id) return res.status(400).json({ error: 'Produto inválido' });
    await repo.saveProduct(product);
    res.json(product);
  }));

  router.delete('/products/:id', handle(async (req, res) => {
    await repo.deleteProduct(req.params.id);
    res.status(204).end();
  }));

  router.post('/products/:id/check', handle(async (req, res) => {
    const product = await repo.getProduct(req.params.id);
    if (!product) return res.status(404).json({ error: 'Produto não encontrado' });
    res.json(await checkAndRecord(repo, product));
  }));

  router.put('/settings', handle(async (req, res) => {
    const settings = { ...DEFAULT_SETTINGS, ...(req.body || {}) };
    await repo.saveSettings(settings);
    res.json(settings);
  }));

  router.post('/alerts', handle(async (req, res) => {
    const alert = req.body as AlertItem;
    if (!alert?.id) return res.status(400).json({ error: 'Alerta inválido' });
    await repo.addAlerts([alert]);
    res.status(201).json(alert);
  }));

  router.delete('/alerts', handle(async (_req, res) => {
    await repo.clearAlerts();
    res.status(204).end();
  }));

  router.post('/import', handle(async (req, res) => {
    await repo.replaceAll(req.body || {});
    res.json(await repo.getState());
  }));

  router.delete('/data', handle(async (_req, res) => {
    await repo.clearProductsAndAlerts();
    res.status(204).end();
  }));

  // --- Monitoramento agendado (chamado pelo GitHub Actions) ---
  router.post('/check-all', handle(async (_req, res) => {
    res.json(await checkAll(repo));
  }));

  // --- Push ---
  router.get('/push/public-key', handle(async (_req, res) => {
    res.json({ publicKey: await getPublicKey(repo) });
  }));

  router.post('/push/subscribe', handle(async (req, res) => {
    const sub = req.body?.subscription;
    if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
      return res.status(400).json({ error: 'Inscrição inválida' });
    }
    await repo.saveSubscription({
      endpoint: sub.endpoint,
      keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
      createdAt: new Date().toISOString(),
      userAgent: req.get('user-agent')?.slice(0, 200),
    });
    res.status(201).json({ ok: true });
  }));

  router.post('/push/unsubscribe', handle(async (req, res) => {
    if (req.body?.endpoint) await repo.deleteSubscription(req.body.endpoint);
    res.status(204).end();
  }));

  router.post('/push/test', handle(async (_req, res) => {
    res.json(
      await sendPushToAll(repo, {
        title: 'WishWatch',
        body: 'Notificação de teste recebida',
        tag: 'test',
        url: '/',
      })
    );
  }));

  return router;
}
