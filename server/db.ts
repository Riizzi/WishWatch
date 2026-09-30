/**
 * Armazenamento chave-valor do servidor.
 *
 * - Com UPSTASH_REDIS_REST_URL e UPSTASH_REDIS_REST_TOKEN: Redis na nuvem via REST
 *   (sem SDK, só fetch). É o modo usado em produção e pelo monitoramento 24/7.
 * - Sem essas variáveis: arquivo local em .data/db.json, útil para desenvolvimento.
 */
import fs from 'fs';
import path from 'path';

export interface KeyValueStore {
  readonly kind: 'upstash' | 'file';
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  del(key: string): Promise<void>;
  hgetall(key: string): Promise<Record<string, string>>;
  hset(key: string, field: string, value: string): Promise<void>;
  hdel(key: string, field: string): Promise<void>;
}

class UpstashStore implements KeyValueStore {
  readonly kind = 'upstash' as const;
  constructor(private url: string, private token: string) {}

  private async command<T = unknown>(args: (string | number)[]): Promise<T> {
    const res = await fetch(this.url.replace(/\/$/, ''), {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    });
    const data = (await res.json().catch(() => ({}))) as { result?: T; error?: string };
    if (!res.ok || data.error) {
      throw new Error(`Upstash: ${data.error || res.status}`);
    }
    return data.result as T;
  }

  async get(key: string) {
    return this.command<string | null>(['GET', key]);
  }
  async set(key: string, value: string) {
    await this.command(['SET', key, value]);
  }
  async del(key: string) {
    await this.command(['DEL', key]);
  }
  async hgetall(key: string) {
    // HGETALL via REST devolve [campo, valor, campo, valor, ...]
    const flat = (await this.command<string[] | null>(['HGETALL', key])) || [];
    const out: Record<string, string> = {};
    for (let i = 0; i + 1 < flat.length; i += 2) out[flat[i]] = flat[i + 1];
    return out;
  }
  async hset(key: string, field: string, value: string) {
    await this.command(['HSET', key, field, value]);
  }
  async hdel(key: string, field: string) {
    await this.command(['HDEL', key, field]);
  }
}

type FileData = { strings: Record<string, string>; hashes: Record<string, Record<string, string>> };

class FileStore implements KeyValueStore {
  readonly kind = 'file' as const;
  private data: FileData;
  constructor(private file: string) {
    try {
      this.data = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
      this.data = { strings: {}, hashes: {} };
    }
  }
  private persist() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file, JSON.stringify(this.data));
  }
  async get(key: string) {
    return this.data.strings[key] ?? null;
  }
  async set(key: string, value: string) {
    this.data.strings[key] = value;
    this.persist();
  }
  async del(key: string) {
    delete this.data.strings[key];
    delete this.data.hashes[key];
    this.persist();
  }
  async hgetall(key: string) {
    return { ...(this.data.hashes[key] || {}) };
  }
  async hset(key: string, field: string, value: string) {
    (this.data.hashes[key] ||= {})[field] = value;
    this.persist();
  }
  async hdel(key: string, field: string) {
    if (this.data.hashes[key]) delete this.data.hashes[key][field];
    this.persist();
  }
}

export function createStore(): KeyValueStore {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (url && token) return new UpstashStore(url, token);
  return new FileStore(process.env.WISHWATCH_DATA_FILE || path.resolve('.data', 'db.json'));
}
