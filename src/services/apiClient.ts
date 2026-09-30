import { PriceResult, Product, UserSettings, AIAnalysisResult } from '../types/index.ts';

export async function fetchPriceCheck(url: string): Promise<PriceResult> {
  const response = await fetch('/api/check-price', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Falha na comunicação com o servidor');
  }

  return response.json();
}

export async function fetchPurchaseAnalysis(product: Product, settings: UserSettings): Promise<AIAnalysisResult> {
  const response = await fetch('/api/analyze-purchase', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ product, settings }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Falha ao analisar compra');
  }

  return response.json();
}
