import React from 'react';
import { Bell, Settings, Plus, RefreshCw, Download, WifiOff } from 'lucide-react';
import { usePWAInstall, useOnlineStatus } from '../hooks/usePWAInstall.ts';
import { AppLogo, ModalShell, ModalHeader } from './ui.tsx';

interface HeaderProps {
  onOpenAdd: () => void;
  onOpenSettings: () => void;
  onOpenAlerts: () => void;
  onRefreshAll: () => void;
  isRefreshingAll: boolean;
  alertCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenAdd,
  onOpenSettings,
  onOpenAlerts,
  onRefreshAll,
  isRefreshingAll,
  alertCount,
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = React.useState(false);
  const isOnline = useOnlineStatus();

  return (
    <>
    <header className="sticky top-0 z-30 bg-[#FAF7F2]/95 backdrop-blur-sm border-b border-[#E8DFD1]">
      <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <AppLogo size={36} className="shrink-0" />
          <h1 className="text-lg sm:text-xl font-bold tracking-tight text-[#292524] leading-none truncate">
            WishWatch
          </h1>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {!isOnline && (
            <div
              className="flex items-center gap-1 px-2 h-8 rounded-lg bg-[#FDF2F0] border border-[#F1B8AF] text-[#991B1B] text-xs font-mono-ledger"
              title="Sem conexão"
            >
              <WifiOff className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Offline</span>
            </div>
          )}

          {!isInstalled && (isInstallable || isIOS) && (
            <button
              type="button"
              onClick={isInstallable ? install : () => setShowIOSGuide(true)}
              title="Instalar aplicativo"
              aria-label="Instalar aplicativo"
              className="retro-btn retro-icon-btn sm:w-auto sm:px-3 text-xs"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Instalar</span>
            </button>
          )}

          <button
            type="button"
            onClick={onRefreshAll}
            disabled={isRefreshingAll}
            title="Atualizar todos"
            aria-label="Atualizar todos"
            className="retro-btn retro-icon-btn hover:bg-[#F5EFE6]"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshingAll ? 'animate-spin' : ''}`} />
          </button>

          <button
            type="button"
            onClick={onOpenAlerts}
            title="Histórico de alertas"
            aria-label={`Histórico de alertas (${alertCount})`}
            className="retro-btn retro-icon-btn relative hover:bg-[#F5EFE6]"
          >
            <Bell className="w-4 h-4" />
            {alertCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 font-mono-ledger bg-[#991B1B] text-white text-[9px] leading-4 px-1 rounded-full min-w-4 text-center">
                {alertCount > 99 ? '99+' : alertCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={onOpenSettings}
            title="Configurações"
            aria-label="Configurações"
            className="retro-btn retro-icon-btn hover:bg-[#F5EFE6]"
          >
            <Settings className="w-4 h-4" />
          </button>

          {/* No mobile o botão flutuante cumpre essa função */}
          <button
            type="button"
            onClick={onOpenAdd}
            className="retro-btn retro-btn-primary hidden sm:inline-flex px-3 text-xs"
          >
            <Plus className="w-4 h-4" />
            Adicionar
          </button>
        </div>
      </div>
    </header>

      {showIOSGuide && (
        <ModalShell onClose={() => setShowIOSGuide(false)} maxWidth="max-w-sm" labelledBy="ios-guide-title">
          <ModalHeader id="ios-guide-title" onClose={() => setShowIOSGuide(false)}>
            <h3 className="font-bold text-[#292524] text-base">Instalar no iPhone / iPad</h3>
          </ModalHeader>
          <ol className="p-4 text-sm text-[#57534E] space-y-2 list-decimal list-inside leading-relaxed">
            <li>Toque em <strong>Compartilhar</strong> na barra do Safari.</li>
            <li>Selecione <strong>Adicionar à Tela de Início</strong>.</li>
            <li>O WishWatch abre em tela cheia, como um app.</li>
          </ol>
        </ModalShell>
      )}
    </>
  );
};
