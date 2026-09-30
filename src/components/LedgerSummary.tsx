import React from 'react';
import { Product } from '../types/index.ts';
import { formatBRL } from '../utils/formatters.ts';

interface LedgerSummaryProps {
  products: Product[];
}

export const LedgerSummary: React.FC<LedgerSummaryProps> = ({ products }) => {
  // 1. Total value of monitoring items
  const activeProducts = products.filter((p) => p.status === 'monitorando');
  const totalWishlistValue = activeProducts.reduce((sum, p) => {
    const currentPrice = p.priceHistory[p.priceHistory.length - 1]?.price || 0;
    return sum + currentPrice;
  }, 0);

  // 2. Count of products with price drop since registration
  const productsWithDrop = activeProducts.filter((p) => {
    if (p.priceHistory.length < 1) return false;
    const initialPrice = p.priceHistory[0]?.price || 0;
    const currentPrice = p.priceHistory[p.priceHistory.length - 1]?.price || 0;
    return initialPrice > 0 && currentPrice < initialPrice;
  }).length;

  // 3. Recorded savings: difference between initial registered price and paid price for bought items
  const boughtProducts = products.filter((p) => p.status === 'comprado');
  const recordedSavings = boughtProducts.reduce((sum, p) => {
    const initialPrice = p.priceHistory[0]?.price || 0;
    const paid = p.paidPrice !== undefined ? p.paidPrice : (p.priceHistory[p.priceHistory.length - 1]?.price || 0);
    const diff = initialPrice - paid;
    return sum + (diff > 0 ? diff : 0);
  }, 0);

  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3 my-4">
      {/* Indicador 1: Total da wishlist */}
      <div className="retro-card p-2.5 sm:p-4 min-w-0">
        <div className="text-[10px] sm:text-xs text-[#78716C] uppercase font-mono-ledger tracking-wider mb-1 truncate">
          Wishlist
        </div>
        <div className="font-mono-ledger text-[13px] sm:text-lg font-bold text-[#292524] tracking-tight whitespace-nowrap">
          {formatBRL(totalWishlistValue)}
        </div>
        <div className="text-[10px] text-[#78716C] font-mono-ledger mt-0.5 truncate">
          {activeProducts.length} {activeProducts.length === 1 ? 'item ativo' : 'itens ativos'}
        </div>
      </div>

      {/* Indicador 2: Produtos com queda */}
      <div className="retro-card p-2.5 sm:p-4 min-w-0">
        <div className="text-[10px] sm:text-xs text-[#78716C] uppercase font-mono-ledger tracking-wider mb-1 truncate">
          Em Queda
        </div>
        <div className="font-mono-ledger text-[13px] sm:text-lg font-bold text-[#166534] flex items-baseline gap-1">
          {productsWithDrop}
          <span className="text-[11px] font-normal text-[#166534]/80">
            ({activeProducts.length > 0 ? Math.round((productsWithDrop / activeProducts.length) * 100) : 0}%)
          </span>
        </div>
        <div className="text-[10px] text-[#78716C] font-mono-ledger mt-0.5 truncate">
          vs. cadastro
        </div>
      </div>

      {/* Indicador 3: Economia registrada */}
      <div className="retro-card p-2.5 sm:p-4 min-w-0">
        <div className="text-[10px] sm:text-xs text-[#78716C] uppercase font-mono-ledger tracking-wider mb-1 truncate">
          Economia
        </div>
        <div className="font-mono-ledger text-[13px] sm:text-lg font-bold text-[#292524] tracking-tight whitespace-nowrap">
          {formatBRL(recordedSavings)}
        </div>
        <div className="text-[10px] text-[#78716C] font-mono-ledger mt-0.5 truncate">
          {boughtProducts.length} {boughtProducts.length === 1 ? 'comprado' : 'comprados'}
        </div>
      </div>
    </div>
  );
};
