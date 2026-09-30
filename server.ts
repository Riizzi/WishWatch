import './server/env.ts';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { createStore } from './server/db.ts';
import { WishWatchRepo } from './server/repo.ts';
import { createApiRouter } from './server/api.ts';

const ROOT = import.meta.dirname;
const app = express();
const PORT = Number(process.env.PORT) || 3000;
const isDev = process.env.NODE_ENV !== 'production' && !process.argv.includes('--production');

const repo = new WishWatchRepo(createStore());

app.use(express.json({ limit: '2mb' }));
app.use('/api', createApiRouter(repo));

// Digital Asset Links: permite que o APK (TWA) abra o site em tela cheia
app.get('/.well-known/assetlinks.json', (_req, res) => {
  res.sendFile(path.resolve(ROOT, 'android', 'assetlinks.json'));
});

async function start() {
  if (isDev) {
    const { createServer } = await import('vite');
    const vite = await createServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const dist = path.resolve(ROOT, 'dist');
    if (!fs.existsSync(dist)) {
      console.error('Pasta dist/ não encontrada. Rode "npm run build" antes de "npm start".');
      process.exit(1);
    }
    app.use(
      express.static(dist, {
        setHeaders(res, file) {
          // O service worker precisa ser sempre revalidado para as atualizações chegarem
          if (file.endsWith('sw.js')) res.setHeader('Cache-Control', 'no-cache');
        },
      })
    );
    app.get('*', (_req, res) => res.sendFile(path.resolve(dist, 'index.html')));
  }

  app.listen(PORT, () => {
    const storage = repo.kind === 'upstash' ? 'Upstash Redis' : 'arquivo local (.data/)';
    console.log(`WishWatch na porta ${PORT} · ${isDev ? 'desenvolvimento' : 'produção'} · dados: ${storage}`);
  });
}

start();
