import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { checkPrice } from './src/services/priceChecker.ts';
import { analyzePurchase } from './src/services/purchaseAnalyzer.ts';

dotenv.config({ path: ['.env.local', '.env'], quiet: true });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ ok: true, gemini: Boolean(process.env.GEMINI_API_KEY) });
});

// API Endpoints
app.post('/api/check-price', async (req: Request, res: Response) => {
  try {
    const { url } = req.body;
    if (!url || typeof url !== 'string') {
      res.status(400).json({ error: 'URL do produto é obrigatória' });
      return;
    }
    const result = await checkPrice(url);
    res.json(result);
  } catch (error: any) {
    console.error('Erro em /api/check-price:', error);
    res.status(500).json({ error: error.message || 'Erro ao verificar preço' });
  }
});

app.post('/api/analyze-purchase', async (req: Request, res: Response) => {
  try {
    const { product, settings } = req.body;
    if (!product) {
      res.status(400).json({ error: 'Dados do produto são obrigatórios' });
      return;
    }
    const result = await analyzePurchase(product, settings || { monthlyIncome: 6000, monthlyHours: 160 });
    res.json(result);
  } catch (error: any) {
    console.error('Erro em /api/analyze-purchase:', error);
    res.status(500).json({ error: error.message || 'Erro ao analisar compra' });
  }
});

// Setup Vite middleware in dev or static serve in prod
async function startServer() {
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`WishWatch rodando na porta ${PORT} (${isDev ? 'desenvolvimento' : 'produção'})`);
  });
}

startServer();
