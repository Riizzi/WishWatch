/** Decide se o app usa dados locais ou o servidor (sincronizado). */
import { storage } from './storage.ts';
import { AuthError, fetchHealth, getAccessKey, setAccessKey, verifyAccessKey, remoteApi } from './apiClient.ts';
import type { ServerHealth } from '../types/index.ts';

const MODE_KEY = 'wishwatch_mode';

export type SyncStatus =
  | 'local' // servidor sem banco na nuvem: dados só neste aparelho
  | 'available' // servidor tem banco, falta a chave de acesso
  | 'remote'; // sincronizado

function savedMode(): string | null {
  try {
    return localStorage.getItem(MODE_KEY);
  } catch {
    return null;
  }
}

function saveMode(mode: 'local' | 'remote') {
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch {
    // ignora
  }
}

export async function initSync(): Promise<{ status: SyncStatus; health: ServerHealth | null }> {
  const health = await fetchHealth();

  // Sem conexão: mantém o último modo usado (o modo remoto tem cópia local)
  if (!health) {
    const remote = savedMode() === 'remote';
    storage.setRemote(remote);
    return { status: remote ? 'remote' : 'local', health };
  }

  if (!health.sync) {
    storage.setRemote(false);
    return { status: 'local', health };
  }

  if (health.auth && !getAccessKey()) {
    storage.setRemote(false);
    return { status: 'available', health };
  }

  try {
    await connect(getAccessKey());
    return { status: 'remote', health };
  } catch (err) {
    if (err instanceof AuthError) setAccessKey('');
    storage.setRemote(false);
    saveMode('local');
    return { status: 'available', health };
  }
}

/**
 * Conecta ao servidor com a chave informada. Na primeira vez, se o servidor
 * estiver vazio e houver produtos neste aparelho, eles são enviados.
 */
export async function connect(key: string): Promise<void> {
  if (key && !(await verifyAccessKey(key))) throw new AuthError();
  setAccessKey(key);

  // Junta os produtos deste aparelho com os do servidor (o servidor prevalece)
  const [remoteState, localState] = await Promise.all([remoteApi.getState(), storage.local.getState()]);
  const remoteIds = new Set(remoteState.products.map((p) => p.id));
  const missing = localState.products.filter((p) => !remoteIds.has(p.id));
  if (missing.length) {
    const firstSync = remoteState.products.length === 0;
    await remoteApi.importState({
      products: [...remoteState.products, ...missing],
      ...(firstSync ? { settings: localState.settings, alerts: localState.alerts } : {}),
    });
  }
  storage.setRemote(true);
  saveMode('remote');
}

export function disconnect() {
  setAccessKey('');
  storage.setRemote(false);
  saveMode('local');
}
