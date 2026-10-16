/** Resumo da wishlist para o hub CL4P-RZ (contrato "wishwatch", schema 1). */
import type { Product } from '../types/index.ts';

const PRIORIDADE: Record<string, string> = { preciso: 'Preciso', quero: 'Quero', desejo: 'Desejo' };

export function montarResumoWish(products: Product[]) {
  return {
    products: products.map((p) => {
      const pontos = p.priceHistory.filter((h) => !h.uncertain && h.price > 0);
      const precos = pontos.map((h) => h.price);
      return {
        id: p.id,
        name: p.name,
        store: p.store,
        category: p.category,
        priority: PRIORIDADE[p.priority] || p.priority,
        reason: p.reason,
        currentPrice: pontos.length ? pontos[pontos.length - 1].price : null,
        targetPrice: p.targetPrice ?? null,
        lowestPrice: precos.length ? Math.min(...precos) : null,
        initialPrice: precos.length ? precos[0] : null,
        status: p.status,
        createdAt: p.createdAt,
        purchasedPrice: p.paidPrice ?? null,
      };
    }),
  };
}
