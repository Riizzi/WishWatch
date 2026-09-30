import { describe, expect, it } from 'vitest';
import { evaluateAlerts, applyPriceResult, alertNotificationBody } from '../src/services/alerts.ts';
import type { PriceResult, Product, UserSettings } from '../src/types/index.ts';

const settings: UserSettings = {
  monthlyIncome: 6000,
  monthlyHours: 160,
  checkIntervalHours: 6,
  dropAlertPercent: 10,
  enableNotifications: true,
};

function product(prices: number[], extra: Partial<Product> = {}): Product {
  return {
    id: 'p1',
    url: 'https://loja.example/p1',
    name: 'Fone',
    reason: 'teste',
    priority: 'quero',
    category: 'Eletrônicos',
    store: 'Amazon',
    createdAt: '2026-09-01T00:00:00Z',
    status: 'monitorando',
    priceHistory: prices.map((price, i) => ({ date: `2026-09-0${i + 1}T00:00:00Z`, price, inStock: true })),
    ...extra,
  };
}

function reading(price: number | null, extra: Partial<PriceResult> = {}): PriceResult {
  return { name: 'Fone', price, currency: 'BRL', store: 'Amazon', inStock: true, confidence: 0.9, uncertain: false, ...extra };
}

const events = (p: Product, r: PriceResult) => evaluateAlerts(p, r, settings).map((a) => a.event);

describe('evaluateAlerts', () => {
  it('avisa quando cruza o preço-alvo', () => {
    expect(events(product([500], { targetPrice: 450 }), reading(440))).toContain('Preço abaixo do alvo');
  });

  it('não repete o alerta de alvo se já estava abaixo', () => {
    expect(events(product([440], { targetPrice: 450 }), reading(430))).not.toContain('Preço abaixo do alvo');
  });

  it('avisa quedas acima do percentual configurado', () => {
    expect(events(product([500]), reading(440))).toContain('Queda de 12% desde a última checagem');
    expect(events(product([500]), reading(480)).some((e) => e.startsWith('Queda'))).toBe(false);
  });

  it('avisa menor preço registrado só quando é estritamente menor', () => {
    expect(events(product([500, 450]), reading(449))).toContain('Menor preço registrado');
    expect(events(product([500, 450]), reading(450))).not.toContain('Menor preço registrado');
  });

  it('avisa volta ao estoque', () => {
    const p = product([500]);
    p.priceHistory[0].inStock = false;
    expect(events(p, reading(500))).toContain('Produto em estoque');
  });

  it('ignora leituras incertas ou sem preço', () => {
    expect(events(product([500], { targetPrice: 450 }), reading(100, { uncertain: true }))).toEqual([]);
    expect(events(product([500]), reading(null))).toEqual([]);
  });
});

describe('applyPriceResult', () => {
  it('acrescenta o ponto ao histórico e registra a checagem', () => {
    const updated = applyPriceResult(product([500]), reading(450), '2026-09-10T00:00:00Z');
    expect(updated.priceHistory).toHaveLength(2);
    expect(updated.lastCheckedAt).toBe('2026-09-10T00:00:00Z');
    expect(updated.lastCheckError).toBeUndefined();
  });

  it('não grava ponto quando o preço não foi lido', () => {
    const updated = applyPriceResult(product([500]), reading(null, { rawText: 'Não foi possível ler esta página' }));
    expect(updated.priceHistory).toHaveLength(1);
    expect(updated.lastCheckError).toBe('Não foi possível ler esta página');
  });
});

describe('alertNotificationBody', () => {
  it('mostra valor, variação e evento', () => {
    const body = alertNotificationBody({
      id: 'a', date: '', productId: 'p1', productName: 'Fone', event: 'Preço abaixo do alvo', value: 85, oldValue: 100,
    });
    expect(body.replace(/ /g, ' ')).toBe('R$ 85,00 (-15%) · Preço abaixo do alvo');
  });
});
