import React, { useEffect, useState } from 'react';
import { Bell, Cloud, CloudOff, KeyRound, LogOut, Send } from 'lucide-react';
import type { ServerHealth } from '../types/index.ts';
import { connect, disconnect, SyncStatus } from '../services/sync.ts';
import { AuthError } from '../services/apiClient.ts';
import { disablePush, enablePush, getPushSubscription, isPushSupported, sendTestPush } from '../services/push.ts';
import { requestNotificationPermission } from '../services/monitor.ts';

const sectionTitle =
  'text-xs font-mono-ledger uppercase text-[#78716C] tracking-wider mb-2 font-bold flex items-center gap-1.5';

export const SyncSection: React.FC<{
  status: SyncStatus;
  health: ServerHealth | null;
  onStatusChange: (status: SyncStatus) => void;
}> = ({ status, health, onStatusChange }) => {
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await connect(key.trim());
      onStatusChange('remote');
    } catch (err) {
      setError(err instanceof AuthError ? 'Chave de acesso inválida' : 'Não foi possível conectar ao servidor');
    } finally {
      setBusy(false);
    }
  };

  const handleDisconnect = () => {
    if (!window.confirm('Desconectar este aparelho? Os dados continuam no servidor.')) return;
    disconnect();
    onStatusChange(health?.sync ? 'available' : 'local');
  };

  return (
    <div>
      <div className={sectionTitle}>
        {status === 'remote' ? <Cloud className="w-3.5 h-3.5" /> : <CloudOff className="w-3.5 h-3.5" />}
        Sincronização
      </div>

      {status === 'remote' && (
        <div className="space-y-2">
          <p className="text-xs text-[#57534E] leading-relaxed">
            <span className="inline-block w-2 h-2 rounded-full bg-[#166534] mr-1.5 align-middle" />
            Conectado ao servidor. Os preços são verificados mesmo com o app fechado.
          </p>
          <button type="button" onClick={handleDisconnect} className="retro-btn w-full text-xs text-[#78716C]">
            <LogOut className="w-4 h-4" />
            Desconectar este aparelho
          </button>
        </div>
      )}

      {status === 'available' && (
        <form onSubmit={handleConnect} className="space-y-2">
          <p className="text-xs text-[#57534E] leading-relaxed">
            O servidor tem banco de dados configurado. Informe a chave de acesso (APP_ACCESS_KEY) para
            sincronizar. Os produtos deste aparelho são enviados na primeira conexão.
          </p>
          <div className="flex gap-2">
            <input
              type="password"
              autoComplete="current-password"
              placeholder="Chave de acesso"
              aria-label="Chave de acesso"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              className="ledger-input font-mono-ledger flex-1 min-w-0"
              required
            />
            <button type="submit" disabled={busy || !key.trim()} className="retro-btn retro-btn-primary text-xs shrink-0">
              <KeyRound className="w-4 h-4" />
              {busy ? 'Conectando' : 'Conectar'}
            </button>
          </div>
          {error && <p className="text-xs text-[#991B1B] font-mono-ledger">{error}</p>}
        </form>
      )}

      {status === 'local' && (
        <p className="text-xs text-[#57534E] leading-relaxed">
          {health
            ? 'Dados salvos só neste aparelho. Para monitorar 24/7 e receber alertas com o app fechado, configure o banco de dados no servidor (docs/CONFIGURACAO.md).'
            : 'Servidor indisponível no momento. Os dados deste aparelho continuam acessíveis.'}
        </p>
      )}
    </div>
  );
};

export const NotificationSection: React.FC<{
  status: SyncStatus;
  localEnabled: boolean;
  onLocalChange: (enabled: boolean) => void;
}> = ({ status, localEnabled, onLocalChange }) => {
  const remote = status === 'remote';
  const [pushOn, setPushOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    if (remote) getPushSubscription().then((s) => setPushOn(!!s));
  }, [remote]);

  const enabled = remote ? pushOn : localEnabled;

  const toggle = async () => {
    setBusy(true);
    setInfo(null);
    try {
      if (remote) {
        if (pushOn) {
          await disablePush();
          setPushOn(false);
        } else {
          await enablePush();
          setPushOn(true);
          setInfo('Notificações ativadas neste aparelho');
        }
      } else if (!localEnabled) {
        const granted = await requestNotificationPermission();
        onLocalChange(granted);
        if (!granted) setInfo('Permissão de notificação negada');
      } else {
        onLocalChange(false);
      }
    } catch (err) {
      setInfo(err instanceof Error ? err.message : 'Não foi possível alterar as notificações');
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    setBusy(true);
    try {
      const r = await sendTestPush();
      setInfo(r.sent > 0 ? `Teste enviado para ${r.sent} aparelho(s)` : 'Nenhum aparelho inscrito');
    } catch {
      setInfo('Falha ao enviar o teste');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-[#FAF7F2] border border-[#E8DFD1]">
        <div className="flex items-center gap-2 min-w-0">
          <Bell className="w-4 h-4 text-[#78716C] shrink-0" />
          <div>
            <div className="text-xs font-semibold text-[#292524]">Notificações</div>
            <div className="text-[10px] text-[#78716C] leading-snug">
              {remote
                ? 'Chegam mesmo com o app fechado'
                : isPushSupported()
                  ? 'Só enquanto o app estiver aberto (modo local)'
                  : 'Enquanto o app estiver aberto'}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={toggle}
          disabled={busy}
          role="switch"
          aria-checked={enabled}
          aria-label="Notificações"
          className={`shrink-0 w-11 h-6 rounded-full transition-colors relative p-0.5 disabled:opacity-60 ${
            enabled ? 'bg-[#166534]' : 'bg-[#D6CFC4]'
          }`}
        >
          <div className={`w-5 h-5 rounded-full bg-white transition-transform ${enabled ? 'translate-x-5' : 'translate-x-0'}`} />
        </button>
      </div>

      {remote && pushOn && (
        <button type="button" onClick={test} disabled={busy} className="retro-btn w-full text-xs">
          <Send className="w-4 h-4" />
          Enviar notificação de teste
        </button>
      )}

      {info && <p className="text-xs font-mono-ledger text-[#57534E]">{info}</p>}
    </div>
  );
};
