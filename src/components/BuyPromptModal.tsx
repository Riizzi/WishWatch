import React, { useState } from 'react';
import { Product } from '../types/index.ts';
import { formatBRL } from '../utils/formatters.ts';
import { CheckCircle } from 'lucide-react';
import { ModalShell, ModalHeader } from './ui.tsx';

interface BuyPromptModalProps {
  product: Product;
  onClose: () => void;
  onConfirm: (paidPrice: number) => void;
}

export const BuyPromptModal: React.FC<BuyPromptModalProps> = ({
  product,
  onClose,
  onConfirm,
}) => {
  const currentPrice = product.priceHistory[product.priceHistory.length - 1]?.price || 0;
  const initialPrice = product.priceHistory[0]?.price || currentPrice;

  const [paidInput, setPaidInput] = useState<string>(currentPrice > 0 ? String(currentPrice) : '');

  const parsedPaid = parseFloat(paidInput.replace(',', '.'));
  const validPaid = !isNaN(parsedPaid) && parsedPaid >= 0 ? parsedPaid : 0;
  const economy = initialPrice - validPaid;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm(validPaid);
  };

  return (
    <ModalShell onClose={onClose} maxWidth="max-w-sm" labelledBy="buy-title">
      <ModalHeader id="buy-title" onClose={onClose}>
        <h3 className="font-bold text-[#292524] text-base">Registrar compra</h3>
      </ModalHeader>

      <div className="p-4 overflow-y-auto">
        <p className="text-xs text-[#78716C] mb-4 leading-relaxed">
          Informe o valor pago para calcular a diferença em relação ao preço do cadastro.
        </p>

        <div className="bg-[#FAF7F2] p-3 rounded-xl border border-[#E8DFD1] space-y-1.5 mb-4 text-xs font-mono-ledger">
          <div className="flex justify-between text-[#78716C]">
            <span>Preço no cadastro</span>
            <span className="text-[#292524] font-bold">{formatBRL(initialPrice)}</span>
          </div>
          <div className="flex justify-between text-[#78716C]">
            <span>Último preço verificado</span>
            <span className="text-[#292524] font-bold">{formatBRL(currentPrice)}</span>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label htmlFor="paid-input" className="ledger-label">
              Valor pago (R$) *
            </label>
            <input
              id="paid-input"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              required
              autoFocus
              value={paidInput}
              onChange={(e) => setPaidInput(e.target.value)}
              className="ledger-input font-mono-ledger text-base"
            />
          </div>

          {economy > 0 ? (
            <div className="p-2.5 rounded-xl bg-[#EAF7EE] border border-[#A3D9B5] text-[#166534] text-xs font-mono-ledger flex justify-between">
              <span>Economia</span>
              <strong>{formatBRL(economy)}</strong>
            </div>
          ) : economy < 0 ? (
            <div className="p-2.5 rounded-xl bg-[#FDF2F0] border border-[#F1B8AF] text-[#991B1B] text-xs font-mono-ledger flex justify-between">
              <span>Acima do preço do cadastro</span>
              <strong>{formatBRL(Math.abs(economy))}</strong>
            </div>
          ) : null}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="retro-btn flex-1 text-xs text-[#78716C]">
              Cancelar
            </button>
            <button type="submit" className="retro-btn retro-btn-success flex-1 text-xs">
              <CheckCircle className="w-4 h-4" />
              Confirmar
            </button>
          </div>
        </form>
      </div>
    </ModalShell>
  );
};
