import React, { useState } from 'react';
import { Product, Priority, PriceResult } from '../types/index.ts';
import { ModalShell, ModalHeader } from './ui.tsx';
import { fetchPriceCheck } from '../services/apiClient.ts';
import { formatBRL } from '../utils/formatters.ts';
import { getStoreStyle } from '../utils/storeConfig.ts';
import { Search, Check, AlertCircle, ArrowRight } from 'lucide-react';

interface AddProductModalProps {
  onClose: () => void;
  onSave: (product: Product) => void;
  initialProduct?: Product | null;
}

const CATEGORIES = ['Eletrônicos', 'Casa', 'Roupas', 'Games', 'Livros', 'Outros'];
const PRIORITIES: { id: Priority; label: string; desc: string }[] = [
  { id: 'preciso', label: 'Preciso', desc: 'Necessidade real ou reposição' },
  { id: 'quero', label: 'Quero', desc: 'Melhoria ou conveniência' },
  { id: 'desejo', label: 'Desejo', desc: 'Lazer ou aspiração futura' },
];

export const AddProductModal: React.FC<AddProductModalProps> = ({
  onClose,
  onSave,
  initialProduct,
}) => {
  const isEditing = !!initialProduct;

  const [url, setUrl] = useState(initialProduct?.url || '');
  const [name, setName] = useState(initialProduct?.name || '');
  const [reason, setReason] = useState(initialProduct?.reason || '');
  const [priority, setPriority] = useState<Priority>(initialProduct?.priority || 'quero');
  const [category, setCategory] = useState(initialProduct?.category || 'Eletrônicos');
  const [store, setStore] = useState(initialProduct?.store || '');
  const [imageUrl, setImageUrl] = useState(initialProduct?.imageUrl || '');
  const [targetPrice, setTargetPrice] = useState<string>(
    initialProduct?.targetPrice ? String(initialProduct.targetPrice) : ''
  );
  const [currentPriceInput, setCurrentPriceInput] = useState<string>(
    initialProduct?.priceHistory[initialProduct.priceHistory.length - 1]?.price
      ? String(initialProduct.priceHistory[initialProduct.priceHistory.length - 1]?.price)
      : ''
  );

  // Verification state
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [priceResult, setPriceResult] = useState<PriceResult | null>(null);

  const handleVerifyUrl = async (urlToCheck?: string) => {
    const targetUrl = (urlToCheck || url).trim();
    if (!targetUrl) return;

    try {
      new URL(targetUrl);
    } catch {
      setVerifyError('Link inválido');
      return;
    }

    setIsVerifying(true);
    setVerifyError(null);

    try {
      const result = await fetchPriceCheck(targetUrl);
      setPriceResult(result);

      if (result.name && !name) setName(result.name);
      if (result.store) setStore(result.store);
      if (result.imageUrl) setImageUrl(result.imageUrl);
      if (result.category && CATEGORIES.includes(result.category)) setCategory(result.category);
      if (result.price !== null) setCurrentPriceInput(String(result.price));

      if (result.uncertain && !result.price) {
        setVerifyError(result.rawText || 'Não foi possível ler o preço desta página. Informe os dados manualmente.');
      }
    } catch (err: any) {
      setVerifyError(err.message || 'Não foi possível ler esta página');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!url.trim()) {
      setVerifyError('O link do produto é obrigatório');
      return;
    }

    if (!name.trim()) {
      setVerifyError('O nome do produto é obrigatório');
      return;
    }

    if (!reason.trim()) {
      setVerifyError('Informe o motivo pelo qual você quer comprar este item');
      return;
    }

    const parsedCurrentPrice = parseFloat(currentPriceInput.replace(',', '.'));
    const finalPrice = !isNaN(parsedCurrentPrice) && parsedCurrentPrice > 0 ? parsedCurrentPrice : 0;

    const parsedTargetPrice = targetPrice.trim()
      ? parseFloat(targetPrice.replace(',', '.'))
      : undefined;

    const now = new Date().toISOString();

    if (isEditing && initialProduct) {
      const updated: Product = {
        ...initialProduct,
        url: url.trim(),
        name: name.trim(),
        reason: reason.trim(),
        priority,
        category,
        store: store || initialProduct.store,
        imageUrl: imageUrl || initialProduct.imageUrl,
        targetPrice: parsedTargetPrice,
      };
      onSave(updated);
      onClose();
      return;
    }

    const newProduct: Product = {
      id: `prod-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      url: url.trim(),
      name: name.trim(),
      reason: reason.trim(),
      priority,
      category,
      store: store || (priceResult?.store || 'Outra'),
      imageUrl: imageUrl || priceResult?.imageUrl || undefined,
      targetPrice: parsedTargetPrice,
      createdAt: now,
      status: 'monitorando',
      priceHistory: [
        {
          date: now,
          price: finalPrice,
          originalPrice: priceResult?.originalPrice || undefined,
          inStock: priceResult ? priceResult.inStock : true,
          uncertain: priceResult?.uncertain || finalPrice === 0,
        },
      ],
    };

    onSave(newProduct);
    onClose();
  };

  const storeStyle = getStoreStyle(store || priceResult?.store || 'Outra');

  return (
    <ModalShell onClose={onClose} maxWidth="max-w-lg" labelledBy="add-product-title">
        <ModalHeader id="add-product-title" onClose={onClose}>
          <h2 className="text-sm sm:text-base font-bold text-[#292524] tracking-tight">
            {isEditing ? 'Editar produto' : 'Adicionar produto'}
          </h2>
        </ModalHeader>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 overflow-y-auto space-y-4">
          {/* Link do produto */}
          <div>
            <label className="ledger-label">
              Link do produto *
            </label>
            <div className="flex gap-2">
              <input
                type="url"
                required
                placeholder="Cole o link do produto"
                inputMode="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onPaste={(e) => {
                  const pasted = e.clipboardData.getData('text');
                  if (pasted && !isEditing) {
                    setTimeout(() => handleVerifyUrl(pasted), 100);
                  }
                }}
                className="ledger-input flex-1 min-w-0"
              />
              <button
                type="button"
                onClick={() => handleVerifyUrl()}
                disabled={isVerifying || !url.trim()}
                aria-label="Verificar preço"
                title="Verificar preço"
                className="retro-btn px-3 text-xs bg-[#FAF7F2] hover:bg-[#F3EEE5] text-[#292524] disabled:opacity-50 shrink-0 font-mono-ledger"
              >
                <Search className="w-4 h-4" />
                <span className="hidden sm:inline">{isVerifying ? 'Lendo' : 'Verificar'}</span>
              </button>
            </div>
          </div>

          {/* Skeleton durante Verificando Preço */}
          {isVerifying && (
            <div className="p-3 border border-[#E8DFD1] rounded-xl bg-[#FAF7F2] space-y-2">
              <div className="flex items-center gap-2 text-xs font-mono-ledger text-[#78716C]">
                <span className="w-2 h-2 rounded-full bg-[#166534] animate-ping" />
                Verificando preço
              </div>
              <div className="h-4 w-3/4 skeleton-ledger" />
              <div className="h-6 w-1/3 skeleton-ledger" />
            </div>
          )}

          {/* Card de pré-visualização quando verificado */}
          {!isVerifying && priceResult && (
            <div className="p-3 border border-[#E8DFD1] rounded-xl bg-[#FAF7F2] flex items-center gap-3">
              {priceResult.imageUrl && (
                <div className="w-14 h-14 bg-white rounded-lg border border-[#E8DFD1] p-1 shrink-0 overflow-hidden flex items-center justify-center">
                  <img
                    src={priceResult.imageUrl}
                    alt={priceResult.name}
                    className="w-full h-full object-contain mix-blend-multiply"
                  />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-1">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: storeStyle.color }}
                  />
                  <span className="text-[10px] font-mono-ledger uppercase text-[#78716C]">
                    {priceResult.store}
                  </span>
                  {priceResult.uncertain && (
                    <span className="ledger-stamp text-[9px] text-[#92400E] border-[#F3D2BA] bg-[#FDF5EE]">
                      CONFERIR VALOR
                    </span>
                  )}
                </div>
                <div className="text-xs font-semibold text-[#292524] truncate">
                  {priceResult.name}
                </div>
                <div className="font-mono-ledger text-sm font-bold text-[#166534] mt-0.5">
                  {priceResult.price !== null ? formatBRL(priceResult.price) : 'Preço não identificado'}
                </div>
              </div>
            </div>
          )}

          {verifyError && (
            <div className="p-2.5 rounded-xl bg-[#FDF2F0] border border-[#F1B8AF] text-[#991B1B] text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{verifyError}</span>
            </div>
          )}

          {/* Nome do produto */}
          <div>
            <label className="ledger-label">
              Nome *
            </label>
            <input
              type="text"
              required
              placeholder="Ex.: Fone Sem Fio Sony WH-1000XM4"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="ledger-input"
            />
          </div>

          {/* Motivo da compra */}
          <div>
            <label className="ledger-label">
              Motivo *
            </label>
            <textarea
              required
              rows={2}
              placeholder="Por que você quer comprar isso?"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="ledger-input"
            />
          </div>

          {/* Preço Atual e Preço Alvo */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="ledger-label">
                Preço atual (R$) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                placeholder="0,00"
                inputMode="decimal"
                value={currentPriceInput}
                onChange={(e) => setCurrentPriceInput(e.target.value)}
                className="ledger-input font-mono-ledger"
              />
            </div>

            <div>
              <label className="ledger-label">
                Preço-alvo (R$)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="Opcional"
                inputMode="decimal"
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
                className="ledger-input font-mono-ledger"
              />
            </div>
          </div>

          {/* Prioridade */}
          <div>
            <label className="ledger-label">
              Prioridade
            </label>
            <div className="grid grid-cols-3 gap-2">
              {PRIORITIES.map((p) => {
                const isSelected = priority === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPriority(p.id)}
                    className={`min-h-11 p-2.5 rounded-xl border text-center sm:text-left transition-colors ${
                      isSelected
                        ? 'bg-[#292524] text-[#FAF7F2] border-[#292524] shadow-[1px_1px_0px_#292524]'
                        : 'bg-[#FAF7F2] text-[#292524] border-[#E8DFD1] hover:bg-[#F3EEE5]'
                    }`}
                  >
                    <div className="font-mono-ledger text-xs font-bold uppercase">{p.label}</div>
                    <div
                      className={`hidden sm:block text-[10px] mt-0.5 line-clamp-2 ${
                        isSelected ? 'text-[#D4C7B5]' : 'text-[#78716C]'
                      }`}
                    >
                      {p.desc}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Categoria */}
          <div>
            <label className="ledger-label">
              Categoria
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="ledger-input"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Botões do rodapé */}
          <div className="pt-2 border-t border-[#E8DFD1] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="retro-btn text-xs px-4 bg-[#FAF7F2] text-[#78716C] hover:bg-[#F3EEE5]"
            >
              Cancelar
            </button>

            <button
              type="submit"
              className="retro-btn retro-btn-primary text-xs px-5"
            >
              <Check className="w-3.5 h-3.5" />
              {isEditing ? 'Salvar' : 'Adicionar'}
            </button>
          </div>
        </form>
    </ModalShell>
  );
};
