import React, { useState } from 'react';
import { ServerHealth, UserSettings } from '../types/index.ts';
import { SyncStatus } from '../services/sync.ts';
import { SyncSection, NotificationSection } from './SyncSettings.tsx';
import Cl4pLinkCard from './Cl4pLinkCard.tsx';
import { ModalShell, ModalHeader } from './ui.tsx';
import { storage } from '../services/storage.ts';
import { formatBRL } from '../utils/formatters.ts';
import {
  Save,
  Database,
  Download,
  Upload,
  Trash2,
  Clock,
  DollarSign,
  Percent,
} from 'lucide-react';

interface SettingsModalProps {
  settings: UserSettings;
  onClose: () => void;
  onSaveSettings: (settings: UserSettings) => void;
  onReloadData: () => void;
  syncStatus: SyncStatus;
  health: ServerHealth | null;
  onSyncStatusChange: (status: SyncStatus) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  settings,
  onClose,
  onSaveSettings,
  onReloadData,
  syncStatus,
  health,
  onSyncStatusChange,
}) => {
  const [income, setIncome] = useState<string>(String(settings.monthlyIncome || 6000));
  const [hours, setHours] = useState<string>(String(settings.monthlyHours || 160));
  const [checkInterval, setCheckInterval] = useState<number>(settings.checkIntervalHours || 6);
  const [dropAlert, setDropAlert] = useState<string>(String(settings.dropAlertPercent || 10));
  const [notifications, setNotifications] = useState<boolean>(settings.enableNotifications);
  const [message, setMessage] = useState<string | null>(null);

  const hourlyRate = (parseFloat(income) || 0) / (parseFloat(hours) || 1);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: UserSettings = {
      ...settings,
      monthlyIncome: Math.max(0, parseFloat(income) || 0),
      monthlyHours: Math.max(1, parseFloat(hours) || 160),
      checkIntervalHours: checkInterval,
      dropAlertPercent: Math.max(1, parseFloat(dropAlert) || 10),
      enableNotifications: notifications,
    };
    onSaveSettings(updated);
    setMessage('Configurações salvas');
    setTimeout(() => setMessage(null), 2500);
  };

  const flash = (text: string) => {
    setMessage(text);
    setTimeout(() => setMessage(null), 2500);
  };

  const run = async (fn: () => Promise<void>, ok: string) => {
    try {
      await fn();
      onReloadData();
      flash(ok);
    } catch {
      alert('Não foi possível concluir. Verifique a conexão.');
    }
  };

  const handleLoadSamples = async () => {
    if (window.confirm('Carregar 3 produtos de exemplo com histórico fictício de 30 dias? Os produtos atuais serão substituídos.')) {
      await run(() => storage.loadSampleData(), 'Exemplo carregado');
    }
  };

  const handleExport = async () => {
    const jsonStr = await storage.exportData();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wishwatch-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      await run(async () => {
        if (!(await storage.importData(content))) throw new Error('JSON inválido');
      }, 'Dados importados');
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleClearData = async () => {
    if (window.confirm('Apagar todos os produtos e alertas? Esta ação não pode ser desfeita.')) {
      await run(() => storage.clearAllData(), 'Dados apagados');
    }
  };

  return (
    <ModalShell onClose={onClose} maxWidth="max-w-lg" labelledBy="settings-title">
        <ModalHeader id="settings-title" onClose={onClose}>
          <h2 className="text-base font-bold text-[#292524] tracking-tight">
            Configurações
          </h2>
        </ModalHeader>

        {/* Content */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-6">
          {message && (
            <div className="p-2.5 rounded-xl bg-[#EAF7EE] border border-[#A3D9B5] text-[#166534] text-xs font-mono-ledger text-center">
              {message}
            </div>
          )}

          <SyncSection status={syncStatus} health={health} onStatusChange={onSyncStatusChange} />

          <Cl4pLinkCard />

          {/* Seção 1: Renda e Horas de Trabalho */}
          <form onSubmit={handleSave} className="space-y-4 pt-3 border-t border-[#E8DFD1]">
            <div>
              <div className="text-xs font-mono-ledger uppercase text-[#78716C] tracking-wider mb-2 font-bold flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5" />
                Custo em horas de trabalho
              </div>
              <p className="text-xs text-[#78716C] mb-3">
                Usado para mostrar quantas horas de trabalho cada produto representa.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="ledger-label">
                    Renda Mensal (R$)
                  </label>
                  <input
                    type="number"
                    step="100"
                    min="0"
                    value={income}
                    onChange={(e) => setIncome(e.target.value)}
                    className="ledger-input font-mono-ledger"
                  />
                </div>

                <div>
                  <label className="ledger-label">
                    Horas Trabalhadas/Mês
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    value={hours}
                    onChange={(e) => setHours(e.target.value)}
                    className="ledger-input font-mono-ledger"
                  />
                </div>
              </div>

              <div className="mt-2 text-xs font-mono-ledger text-[#78716C] bg-[#FAF7F2] p-2 rounded-lg border border-[#E8DFD1]">
                Valor da hora: <strong>{formatBRL(hourlyRate)}/h</strong>
              </div>
            </div>

            {/* Seção 2: Monitoramento e Alertas */}
            <div className="pt-3 border-t border-[#E8DFD1] space-y-3">
              <div className="text-xs font-mono-ledger uppercase text-[#78716C] tracking-wider mb-1 font-bold flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                Monitoramento
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="ledger-label">
                    Checagem com app aberto
                  </label>
                  <select
                    value={checkInterval}
                    onChange={(e) => setCheckInterval(Number(e.target.value))}
                    className="ledger-input"
                  >
                    <option value={1}>A cada 1 hora</option>
                    <option value={3}>A cada 3 horas</option>
                    <option value={6}>A cada 6 horas</option>
                    <option value={12}>A cada 12 horas</option>
                    <option value={24}>A cada 24 horas</option>
                  </select>
                </div>

                <div>
                  <label className="ledger-label">
                    % de Queda p/ Alerta
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="1"
                      max="90"
                      value={dropAlert}
                      onChange={(e) => setDropAlert(e.target.value)}
                      className="ledger-input font-mono-ledger"
                    />
                    <Percent className="w-3 h-3 text-[#78716C] absolute right-3 top-3" />
                  </div>
                </div>
              </div>
              <NotificationSection
                status={syncStatus}
                localEnabled={notifications}
                onLocalChange={(enabled) => {
                  setNotifications(enabled);
                  onSaveSettings({ ...settings, enableNotifications: enabled });
                }}
              />
            </div>

            <button
              type="submit"
              className="retro-btn retro-btn-primary w-full text-xs"
            >
              <Save className="w-3.5 h-3.5" />
              Salvar
            </button>
          </form>

          {/* Seção 3: Exemplos e Backup */}
          <div className="pt-3 border-t border-[#E8DFD1] space-y-3">
            <div className="text-xs font-mono-ledger uppercase text-[#78716C] tracking-wider mb-1 font-bold flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5" />
              Dados
            </div>

            {/* Botão Carregar Exemplo */}
            <button
              type="button"
              onClick={handleLoadSamples}
              className="retro-btn w-full text-xs bg-[#FAF7F2] hover:bg-[#F3EEE5]"
            >
              Carregar exemplo (3 produtos, 30 dias)
            </button>

            {/* Exportar e Importar */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleExport}
                className="retro-btn text-xs bg-[#FAF7F2] hover:bg-[#F3EEE5] text-[#292524]"
              >
                <Download className="w-3.5 h-3.5" />
                Exportar JSON
              </button>

              <label className="retro-btn text-xs bg-[#FAF7F2] hover:bg-[#F3EEE5] text-[#292524] cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                Importar JSON
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImport}
                  className="hidden"
                />
              </label>
            </div>

            {/* Limpar dados */}
            <button
              type="button"
              onClick={handleClearData}
              className="retro-btn w-full text-xs text-[#991B1B] hover:bg-[#FDF2F0] border-[#F1B8AF]"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Apagar produtos e alertas
            </button>
          </div>
        </div>
    </ModalShell>
  );
};
