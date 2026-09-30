import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wishwatch-'));
process.env.WISHWATCH_DATA_FILE = path.join(tmp, 'db.json');

// Leitura de preço simulada (sem chamar o Gemini)
const nextPrice = { value: 90 as number | null };
vi.mock('../src/services/priceChecker.ts', () => ({
  checkPrice: vi.fn(async () => ({
    name: 'Fone', price: nextPrice.value, currency: 'BRL', store: 'Amazon', inStock: true, confidence: 0.9, uncertain: nextPrice.value === null,
  })),
}));

const pushes: unknown[] = [];
vi.mock('../server/push.ts', () => ({
  getPublicKey: vi.fn(async () => 'chave'),
  sendPushToAll: vi.fn(async (_repo: unknown, payload: unknown) => {
    pushes.push(payload);
    return { sent: 1, removed: 0, total: 1 };
  }),
}));

const { createStore } = await import('../server/db.ts');
const { WishWatchRepo } = await import('../server/repo.ts');
const { checkAll } = await import('../server/api.ts');

describe('monitoramento no servidor', () => {
  const repo = new WishWatchRepo(createStore());

  beforeEach(async () => {
    pushes.length = 0;
    await repo.clearProductsAndAlerts();
    await repo.saveProduct({
      id: 'p1', url: 'https://loja.example/p1', name: 'Fone', reason: 'teste', priority: 'quero', category: 'Eletrônicos',
      store: 'Amazon', createdAt: '2026-09-01T00:00:00Z', status: 'monitorando', targetPrice: 95,
      priceHistory: [{ date: '2026-09-01T00:00:00Z', price: 100, inStock: true }],
    });
  });

  afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

  it('grava o histórico, registra alertas e envia uma notificação por produto', async () => {
    nextPrice.value = 85;
    const summary = await checkAll(repo, 0);

    expect(summary).toMatchObject({ checked: 1, failed: 0 });
    const [p] = await repo.getProducts();
    expect(p.priceHistory.map((h) => h.price)).toEqual([100, 85]);
    expect((await repo.getAlerts()).map((a) => a.event)).toEqual(
      expect.arrayContaining(['Preço abaixo do alvo', 'Queda de 15% desde a última checagem', 'Menor preço registrado'])
    );
    expect(pushes).toHaveLength(1);
    expect(pushes[0]).toMatchObject({ title: 'Fone', url: '/?product=p1' });
  });

  it('não notifica quando o preço não foi lido', async () => {
    nextPrice.value = null;
    const summary = await checkAll(repo, 0);
    expect(summary.failed).toBe(1);
    expect(pushes).toHaveLength(0);
    const [p] = await repo.getProducts();
    expect(p.lastCheckError).toBeTruthy();
  });

  it('ignora produtos arquivados ou comprados', async () => {
    const [p] = await repo.getProducts();
    await repo.saveProduct({ ...p, status: 'arquivado' });
    expect((await checkAll(repo, 0)).checked).toBe(0);
  });
});
