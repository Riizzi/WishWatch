import React from 'react';
import { Product, UserSettings } from '../types/index.ts';
import { formatBRL, formatTimeAgo, calculateWorkHours } from '../utils/formatters.ts';
import { getStoreStyle } from '../utils/storeConfig.ts';
import { RefreshCw, ArrowDownRight, ArrowUpRight, Minus, AlertCircle } from 'lucide-react';
import { ProductThumb } from './ui.tsx';

interface ProductCardProps {
  product: Product;
  settings: UserSettings;
  onClick: () => void;
  onRefresh: (e: React.MouseEvent) => void;
  isRefreshing: boolean;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  settings,
  onClick,
  onRefresh,
  isRefreshing,
}) => {
  const storeStyle = getStoreStyle(product.store);
  const history = product.priceHistory;
  const currentPoint = history[history.length - 1];
  const initialPoint = history[0];

  const currentPrice = currentPoint?.price ?? 0;
  const initialPrice = initialPoint?.price ?? currentPrice;

  // Variation percentage since registration
  const priceDiff = initialPrice > 0 ? currentPrice - initialPrice : 0;
  const percentDiff = initialPrice > 0 ? ((currentPrice - initialPrice) / initialPrice) * 100 : 0;

  // Working hours
  const workHours = calculateWorkHours(currentPrice, settings.monthlyIncome, settings.monthlyHours);

  // Verification time
  const lastCheckDate = currentPoint?.date || product.createdAt;
  const verifiedText = formatTimeAgo(lastCheckDate);

  // Status stamps logic:
  // 1. MENOR PREÇO: current price is the minimum of all recorded prices
  // (estritamente menor que todos os registros anteriores; empate não conta)
  const previousPrices = history.slice(0, -1).map((p) => p.price).filter((p) => p > 0);
  const isLowest =
    currentPrice > 0 && previousPrices.length > 0 && currentPrice < Math.min(...previousPrices);

  // 2. ABAIXO DO ALVO: target price reached
  const isBelowTarget = product.targetPrice ? currentPrice <= product.targetPrice : false;

  // 3. DESCONTO INFLADO: store displays "de R$ 500 por R$ 350", but history shows price was already <= currentPrice previously
  const hasOriginalPrice = currentPoint?.originalPrice && currentPoint.originalPrice > currentPrice;
  const hadSameOrLowerPriceBefore = history.slice(0, -1).some((p) => p.price <= currentPrice);
  const isInflatedDiscount = hasOriginalPrice && hadSameOrLowerPriceBefore;

  // Mini sparkline data
  const sparklinePoints = history.map((p) => p.price).filter((p) => p > 0);
  const minP = Math.min(...sparklinePoints);
  const maxP = Math.max(...sparklinePoints);
  const pRange = maxP - minP || 1;

  // SVG sparkline path
  const svgW = 64;
  const svgH = 24;
  const pointsString = sparklinePoints
    .map((val, idx) => {
      const x = (idx / Math.max(sparklinePoints.length - 1, 1)) * (svgW - 8) + 4;
      const y = svgH - 4 - ((val - minP) / pRange) * (svgH - 8);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick();
        }
      }}
      className="retro-card retro-card-interactive group relative p-3 sm:p-4 hover:border-[#D4C7B5]"
    >
      {/* Zero-pill folder tab: topo do card estilo pasta suspensa */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Loja tab */}
          <div
            className="folder-tab"
            style={{
              borderColor: storeStyle.borderColor,
              backgroundColor: storeStyle.bgColor,
              color: storeStyle.textColor,
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: storeStyle.color }}
            />
            {product.store}
          </div>

          {/* Categoria tab */}
          <div className="folder-tab text-[#78716C]">
            {product.category}
          </div>

          {/* Prioridade tab */}
          <div className="folder-tab text-[#78716C]">
            {product.priority}
          </div>
        </div>

        {/* Verificado há X min */}
        <div className="text-[10px] font-mono-ledger text-[#78716C] whitespace-nowrap">
          {verifiedText}
        </div>
      </div>

      {/* Main card body */}
      <div className="flex items-start gap-3">
        <ProductThumb
          src={product.imageUrl}
          alt={product.name}
          className="w-16 h-16 sm:w-20 sm:h-20"
        />

        {/* Informações centrais */}
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-sm sm:text-base text-[#292524] line-clamp-2 leading-snug">
            {product.name}
          </h2>

          {/* Motivo declarado */}
          <p className="text-xs text-[#78716C] line-clamp-1 mt-1 italic">
            &ldquo;{product.reason}&rdquo;
          </p>

          {/* Carimbos e tags */}
          <div className="flex items-center gap-1.5 flex-wrap mt-2">
            {product.status === 'comprado' && (
              <span className="ledger-stamp text-[#166534] border-[#A3D9B5] bg-[#EAF7EE]/60">
                COMPRADO
              </span>
            )}
            {product.status === 'arquivado' && (
              <span className="ledger-stamp text-[#78716C] border-[#D6CFC4] bg-[#F5EFE6]/60">
                ARQUIVADO
              </span>
            )}
            {product.status === 'monitorando' && isLowest && (
              <span className="ledger-stamp text-[#166534] border-[#A3D9B5] bg-[#EAF7EE]/60">
                MENOR PREÇO
              </span>
            )}
            {product.status === 'monitorando' && isBelowTarget && (
              <span className="ledger-stamp text-[#166534] border-[#A3D9B5] bg-[#EAF7EE]/60">
                ABAIXO DO ALVO
              </span>
            )}
            {product.status === 'monitorando' && isInflatedDiscount && (
              <span className="ledger-stamp text-[#991B1B] border-[#F1B8AF] bg-[#FDF2F0]/80">
                DESCONTO INFLADO
              </span>
            )}
            {currentPoint?.uncertain && (
              <span className="ledger-stamp text-[#92400E] border-[#F3D2BA] bg-[#FDF5EE]">
                REVISÃO MANUAL
              </span>
            )}
          </div>
        </div>

        {/* Coluna de Preço verticalmente alinhada */}
        <div className="text-right shrink-0 flex flex-col items-end">
          {/* Preço original "de" riscado se houver */}
          {!!currentPoint?.originalPrice && currentPoint.originalPrice > currentPrice && (
            <span className="font-mono-ledger text-[10px] text-[#78716C] line-through">
              {formatBRL(currentPoint.originalPrice)}
            </span>
          )}

          {/* Preço atual */}
          <div
            key={currentPoint?.date}
            className="price-fade font-mono-ledger text-base sm:text-lg font-bold text-[#292524] tracking-tight"
          >
            {formatBRL(currentPrice)}
          </div>

          {/* Variação em relação ao cadastro */}
          <div className="flex items-center gap-0.5 mt-0.5">
            {priceDiff < 0 ? (
              <span className="font-mono-ledger text-xs font-bold text-[#166534] flex items-center bg-[#EAF7EE] px-1.5 py-0.5 rounded border border-[#A3D9B5]">
                <ArrowDownRight className="w-3 h-3 mr-0.5" />
                {Math.round(percentDiff)}%
              </span>
            ) : priceDiff > 0 ? (
              <span className="font-mono-ledger text-xs font-bold text-[#991B1B] flex items-center bg-[#FDF2F0] px-1.5 py-0.5 rounded border border-[#F1B8AF]">
                <ArrowUpRight className="w-3 h-3 mr-0.5" />
                +{Math.round(percentDiff)}%
              </span>
            ) : (
              <span className="font-mono-ledger text-xs text-[#78716C] flex items-center px-1">
                <Minus className="w-3 h-3 mr-0.5" />
                0%
              </span>
            )}
          </div>

          {/* Mini sparkline */}
          {sparklinePoints.length > 1 && (
            <div className="mt-1.5">
              <svg width={svgW} height={svgH} className="overflow-visible">
                <polyline
                  fill="none"
                  stroke="#78716C"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={pointsString}
                />
                {/* Ponto atual */}
                {sparklinePoints.length > 0 && (
                  <circle
                    cx={(svgW - 4)}
                    cy={svgH - 4 - ((sparklinePoints[sparklinePoints.length - 1] - minP) / pRange) * (svgH - 8)}
                    r="2.5"
                    fill={priceDiff <= 0 ? '#166534' : '#991B1B'}
                  />
                )}
              </svg>
            </div>
          )}
        </div>
      </div>

      {/* Rodapé do card: botão discreto atualizar e aviso de estoque */}
      <div className="mt-3 pt-2 border-t border-[#E8DFD1]/60 flex items-center justify-between text-xs text-[#78716C]">
        <div className="flex items-center gap-x-3 gap-y-0.5 flex-wrap min-w-0">
          {currentPoint && !currentPoint.inStock && (
            <span className="font-mono-ledger text-[10px] text-[#991B1B] flex items-center gap-1 font-bold">
              <AlertCircle className="w-3 h-3" />
              Esgotado na loja
            </span>
          )}
          <span className="font-mono-ledger text-[10px]">{workHours} de trabalho</span>
          {!!product.targetPrice && (
            <span className="font-mono-ledger text-[10px]">
              Alvo {formatBRL(product.targetPrice)}
            </span>
          )}
        </div>

        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          title="Verificar preço deste produto"
          className="text-xs font-mono-ledger text-[#78716C] hover:text-[#292524] flex items-center gap-1.5 px-2 min-h-9 -mr-2 rounded-lg hover:bg-[#F3EEE5] transition-colors disabled:opacity-60"
        >
          <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span>{isRefreshing ? 'Verificando' : 'Atualizar'}</span>
        </button>
      </div>
    </div>
  );
};
