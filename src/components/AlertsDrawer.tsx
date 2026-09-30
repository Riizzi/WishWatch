import React from 'react';
import { AlertItem } from '../types/index.ts';
import { formatBRL, formatDateFull } from '../utils/formatters.ts';
import { Trash2, Bell, ChevronRight } from 'lucide-react';
import { ModalShell, ModalHeader } from './ui.tsx';

interface AlertsDrawerProps {
  alerts: AlertItem[];
  onClose: () => void;
  onClearAlerts: () => void;
  onSelectProduct: (productId: string) => void;
}

export const AlertsDrawer: React.FC<AlertsDrawerProps> = ({
  alerts,
  onClose,
  onClearAlerts,
  onSelectProduct,
}) => {
  return (
    <ModalShell onClose={onClose} maxWidth="max-w-lg" labelledBy="alerts-title">
      <ModalHeader id="alerts-title" onClose={onClose}>
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-[#78716C]" />
          <h3 className="font-bold text-[#292524] text-base">Alertas</h3>
          <span className="font-mono-ledger text-xs text-[#78716C]">({alerts.length})</span>
        </div>
      </ModalHeader>

      <div className="overflow-y-auto p-3 sm:p-4 space-y-2 flex-1">
        {alerts.length === 0 ? (
          <div className="py-12 text-center text-xs font-mono-ledger text-[#78716C]">
            Nenhum alerta registrado.
          </div>
        ) : (
          alerts.map((alert) => {
            const diffPercent =
              alert.oldValue && alert.oldValue > alert.value
                ? Math.round(((alert.oldValue - alert.value) / alert.oldValue) * 100)
                : null;

            return (
              <button
                type="button"
                key={alert.id}
                onClick={() => {
                  onSelectProduct(alert.productId);
                  onClose();
                }}
                className="w-full text-left p-3 rounded-xl bg-[#FAF7F2] border border-[#E8DFD1] hover:border-[#D4C7B5] transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-[#292524] truncate">{alert.productName}</div>
                    <div className="font-mono-ledger text-[11px] text-[#166534] font-bold mt-0.5">{alert.event}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-mono-ledger text-sm font-bold text-[#292524]">{formatBRL(alert.value)}</div>
                    {diffPercent !== null && (
                      <span className="font-mono-ledger text-[10px] text-[#166534]">-{diffPercent}%</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between text-[10px] font-mono-ledger text-[#78716C] mt-2 pt-1.5 border-t border-[#E8DFD1]/60">
                  <span>{formatDateFull(alert.date)}</span>
                  <span className="flex items-center gap-1 text-[#292524]">
                    Ver produto <ChevronRight className="w-3 h-3" />
                  </span>
                </div>
              </button>
            );
          })
        )}
      </div>

      {alerts.length > 0 && (
        <div className="p-3 border-t border-[#E8DFD1] bg-[#FAF7F2] shrink-0">
          <button
            type="button"
            onClick={() => {
              if (window.confirm('Limpar todos os registros de alertas?')) onClearAlerts();
            }}
            className="retro-btn w-full text-xs text-[#991B1B] hover:bg-[#FDF2F0]"
          >
            <Trash2 className="w-4 h-4" />
            Limpar histórico
          </button>
        </div>
      )}
    </ModalShell>
  );
};
