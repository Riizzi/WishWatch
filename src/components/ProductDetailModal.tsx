import React, { useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  CartesianGrid,
} from 'recharts';
import { Product, UserSettings, AIAnalysisResult } from '../types/index.ts';
import { formatBRL, formatDateShort, formatDateFull, calculateWorkHours } from '../utils/formatters.ts';
import { getStoreStyle } from '../utils/storeConfig.ts';
import { fetchPurchaseAnalysis } from '../services/apiClient.ts';
import {
  ExternalLink,
  CheckCircle,
  Archive,
  Trash2,
  Sparkles,
  RefreshCw,
  Pencil,
  ArchiveRestore,
  RotateCcw,
  Calendar,
  Clock,
} from 'lucide-react';
import { ModalShell, ModalHeader, ProductThumb } from './ui.tsx';

interface ProductDetailModalProps {
  product: Product;
  settings: UserSettings;
  onClose: () => void;
  onUpdate: (updated: Product) => void;
  onDelete: (id: string) => void;
  onOpenBuyPrompt: (product: Product) => void;
  onEdit: (product: Product) => void;
  onRefreshPrice: (product: Product) => void;
  isRefreshing: boolean;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  product,
  settings,
  onClose,
  onUpdate,
  onDelete,
  onOpenBuyPrompt,
  onEdit,
  onRefreshPrice,
  isRefreshing,
}) => {
  const storeStyle = getStoreStyle(product.store);
  const history = product.priceHistory;
  const currentPrice = history[history.length - 1]?.price ?? 0;
  const initialPrice = history[0]?.price ?? currentPrice;

  // Stats
  const prices = history.map((p) => p.price).filter((p) => p > 0);
  const minPrice = prices.length ? Math.min(...prices) : currentPrice;
  const maxPrice = prices.length ? Math.max(...prices) : currentPrice;
  const avgPrice = prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : currentPrice;

  // Working hours
  const workHours = calculateWorkHours(currentPrice, settings.monthlyIncome, settings.monthlyHours);

  // AI Analysis state
  const [analysis, setAnalysis] = useState<AIAnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const handleRunAnalysis = async () => {
    setIsAnalyzing(true);
    setAnalysisError(null);
    try {
      const result = await fetchPurchaseAnalysis(product, settings);
      setAnalysis(result);
    } catch {
      setAnalysisError('Não foi possível obter a análise. Tente novamente em alguns minutos.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleArchiveToggle = () => {
    const newStatus = product.status === 'arquivado' ? 'monitorando' : 'arquivado';
    onUpdate({ ...product, status: newStatus });
  };

  // Recharts data format
  const chartData = history.map((point) => ({
    rawDate: point.date,
    date: formatDateShort(point.date),
    fullDate: formatDateFull(point.date),
    price: point.price,
    inStock: point.inStock,
    uncertain: point.uncertain,
  }));

  return (
    <ModalShell onClose={onClose} maxWidth="max-w-2xl" labelledBy="detail-title">
      <ModalHeader onClose={onClose}>
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: storeStyle.color }} />
          <span className="font-mono-ledger text-xs uppercase tracking-wider text-[#78716C] truncate">
            {product.store} · {product.category}
          </span>
        </div>
      </ModalHeader>

        {/* Conteúdo com scroll */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6">
          {/* Topo do produto */}
          <div className="flex flex-col sm:flex-row gap-4 items-start">
            <ProductThumb
              src={product.imageUrl}
              alt={product.name}
              className="w-24 h-24 rounded-xl self-center sm:self-start"
              iconSize="w-8 h-8"
            />

            <div className="flex-1 min-w-0">
              <h2 id="detail-title" className="text-base sm:text-lg font-bold text-[#292524] leading-snug">
                {product.name}
              </h2>

              <div className="flex items-center gap-x-4 gap-y-1 flex-wrap mt-2">
                <span className="font-mono-ledger text-xs text-[#78716C] flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  Cadastrado: {formatDateShort(product.createdAt)}
                </span>
                                <span className="font-mono-ledger text-xs text-[#78716C]">
                  Prioridade: <strong className="text-[#292524] uppercase">{product.priority}</strong>
                </span>
                                <span className="font-mono-ledger text-xs text-[#78716C] flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {workHours} de trabalho
                </span>
              </div>
            </div>
          </div>

          {/* Motivo em destaque como anotação de livro contábil */}
          <div className="bg-[#FAF7F2] border border-[#E8DFD1] rounded-xl p-3 sm:p-4 relative">
            <div className="text-[10px] font-mono-ledger uppercase text-[#78716C] tracking-wider mb-1">
              Motivo
            </div>
            <p className="text-sm text-[#292524] italic leading-relaxed">
              &ldquo;{product.reason}&rdquo;
            </p>
          </div>

          {/* Indicadores de preço (Atual, Mínimo, Máximo, Médio, Alvo) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
            <div className="retro-card p-3 bg-[#FFFDF9]">
              <div className="text-[10px] font-mono-ledger text-[#78716C] uppercase">Preço Atual</div>
              <div className="font-mono-ledger text-base sm:text-lg font-bold text-[#292524] mt-0.5">
                {formatBRL(currentPrice)}
              </div>
            </div>

            <div className="retro-card p-3 bg-[#FFFDF9]">
              <div className="text-[10px] font-mono-ledger text-[#78716C] uppercase">Mínimo Histórico</div>
              <div className="font-mono-ledger text-base sm:text-lg font-bold text-[#166534] mt-0.5">
                {formatBRL(minPrice)}
              </div>
            </div>

            <div className="retro-card p-3 bg-[#FFFDF9]">
              <div className="text-[10px] font-mono-ledger text-[#78716C] uppercase">Médio Histórico</div>
              <div className="font-mono-ledger text-base sm:text-lg font-bold text-[#78716C] mt-0.5">
                {formatBRL(avgPrice)}
              </div>
            </div>

            <div className="retro-card p-3 bg-[#FFFDF9]">
              <div className="text-[10px] font-mono-ledger text-[#78716C] uppercase">Preço-Alvo</div>
              <div className="font-mono-ledger text-base sm:text-lg font-bold text-[#292524] mt-0.5">
                {formatBRL(product.targetPrice)}
              </div>
            </div>
          </div>

          {/* Gráfico de histórico com Recharts */}
          <div className="retro-card p-4 bg-[#FFFDF9]">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-mono-ledger uppercase text-[#78716C] tracking-wider">
                Histórico de preço
              </span>
              <span className="text-[10px] font-mono-ledger text-[#78716C]">
                {history.length} {history.length === 1 ? 'registro' : 'registros'}
              </span>
            </div>

            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="#E8DFD1" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="date"
                    stroke="#78716C"
                    fontSize={10}
                    tickLine={false}
                    axisLine={{ stroke: '#E8DFD1' }}
                    fontFamily="'Space Mono', monospace"
                  />
                  <YAxis
                    stroke="#78716C"
                    fontSize={10}
                    tickLine={false}
                    axisLine={{ stroke: '#E8DFD1' }}
                    fontFamily="'Space Mono', monospace"
                    domain={[(min: number) => Math.max(0, Math.floor(min * 0.95)), (max: number) => Math.ceil(max * 1.05)]}
                    width={64}
                    tickFormatter={(val: number) => Math.round(val).toLocaleString('pt-BR')}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length) return null;
                      const data = payload[0].payload;
                      return (
                        <div className="bg-[#FFFDF9] border border-[#E8DFD1] p-2 rounded shadow-[2px_2px_0px_#E5DCD0] font-mono-ledger text-xs">
                          <div className="text-[#78716C] text-[10px]">{data.fullDate}</div>
                          <div className="font-bold text-[#292524] text-sm mt-0.5">
                            {formatBRL(data.price)}
                          </div>
                          {!data.inStock && (
                            <div className="text-[#991B1B] text-[10px] font-bold">Sem estoque</div>
                          )}
                        </div>
                      );
                    }}
                  />
                  {!!product.targetPrice && (
                    <ReferenceLine
                      y={product.targetPrice}
                      stroke="#166534"
                      strokeDasharray="4 4"
                      ifOverflow="extendDomain"
                      label={{
                        value: `Alvo ${formatBRL(product.targetPrice)}`,
                        position: 'insideTopRight',
                        fill: '#166534',
                        fontSize: 10,
                        fontFamily: "'Space Mono', monospace",
                      }}
                    />
                  )}
                  <Line
                    type="monotone"
                    dataKey="price"
                    stroke="#292524"
                    strokeWidth={1.5}
                    dot={{ fill: '#292524', r: 3, strokeWidth: 0 }}
                    activeDot={{ fill: '#166534', r: 5, strokeWidth: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Análise da IA (Gemini) */}
          <div className="retro-card p-4 bg-[#FAF7F2] border border-[#E8DFD1]">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-1.5 text-xs font-mono-ledger uppercase text-[#292524] font-bold tracking-wider">
                <Sparkles className="w-4 h-4 text-[#78716C]" />
                Análise da IA
              </div>

              <button
                onClick={handleRunAnalysis}
                disabled={isAnalyzing}
                className="retro-btn text-xs px-2.5 bg-[#FFFDF9] hover:bg-[#F3EEE5] text-[#292524] disabled:opacity-50"
              >
                {isAnalyzing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Analisando...
                  </>
                ) : (
                  'Analisar compra'
                )}
              </button>
            </div>

            {analysisError && (
              <p className="text-xs text-[#991B1B] font-mono-ledger mt-2">
                {analysisError}
              </p>
            )}

            {analysis && (
              <div className="mt-3 pt-3 border-t border-[#E8DFD1] space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono-ledger text-[#78716C]">Recomendação:</span>
                  <span
                    className={`ledger-stamp ${
                      analysis.recommendation === 'Comprar agora'
                        ? 'text-[#166534] border-[#A3D9B5] bg-[#EAF7EE]'
                        : 'text-[#92400E] border-[#F3D2BA] bg-[#FDF5EE]'
                    }`}
                  >
                    {analysis.recommendation.toUpperCase()}
                  </span>
                </div>
                <p className="text-xs text-[#292524] leading-relaxed font-sans">
                  {analysis.justification}
                </p>
                <div className="text-[10px] text-[#78716C] font-mono-ledger">
                  Avaliado em: {formatDateFull(analysis.assessedAt)}
                </div>
              </div>
            )}

            {!analysis && !isAnalyzing && !analysisError && (
              <p className="text-xs text-[#78716C] mt-1 leading-relaxed">
                Avalia histórico, tendência, motivo e prioridade para indicar se é melhor comprar agora ou aguardar.
              </p>
            )}
          </div>
        </div>

        {/* Rodapé com botões de ação */}
        <div className="p-3 sm:p-4 border-t border-[#E8DFD1] bg-[#FAF7F2] shrink-0 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <a
              href={product.url}
              target="_blank"
              rel="noopener noreferrer"
              className="retro-btn text-xs hover:bg-[#F3EEE5]"
            >
              <ExternalLink className="w-4 h-4" />
              Abrir na loja
            </a>
            <button
              type="button"
              onClick={() => onRefreshPrice(product)}
              disabled={isRefreshing}
              className="retro-btn text-xs hover:bg-[#F3EEE5]"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Verificando' : 'Atualizar preço'}
            </button>
          </div>

          <div className="flex items-center gap-2">
            {product.status === 'comprado' ? (
              <button
                type="button"
                onClick={() => onUpdate({ ...product, status: 'monitorando', paidPrice: undefined })}
                className="retro-btn flex-1 text-xs hover:bg-[#F3EEE5]"
              >
                <RotateCcw className="w-4 h-4" />
                Voltar a monitorar
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onOpenBuyPrompt(product)}
                className="retro-btn retro-btn-success flex-1 text-xs"
              >
                <CheckCircle className="w-4 h-4" />
                Registrar compra
              </button>
            )}

            <button
              type="button"
              onClick={() => onEdit(product)}
              className="retro-btn retro-icon-btn hover:bg-[#F3EEE5]"
              title="Editar"
              aria-label="Editar"
            >
              <Pencil className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handleArchiveToggle}
              className="retro-btn retro-icon-btn text-[#78716C] hover:bg-[#F3EEE5]"
              title={product.status === 'arquivado' ? 'Desarquivar' : 'Arquivar'}
              aria-label={product.status === 'arquivado' ? 'Desarquivar' : 'Arquivar'}
            >
              {product.status === 'arquivado' ? (
                <ArchiveRestore className="w-4 h-4" />
              ) : (
                <Archive className="w-4 h-4" />
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                if (window.confirm('Excluir este produto da wishlist?')) {
                  onDelete(product.id);
                  onClose();
                }
              }}
              className="retro-btn retro-icon-btn text-[#991B1B] hover:bg-[#FDF2F0]"
              title="Excluir"
              aria-label="Excluir"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
    </ModalShell>
  );
};
