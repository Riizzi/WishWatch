import { GoogleGenAI } from '@google/genai';
import { Product, UserSettings, AIAnalysisResult } from '../types/index.ts';

export async function analyzePurchase(product: Product, settings: UserSettings): Promise<AIAnalysisResult> {
  const currentPrice = product.priceHistory[product.priceHistory.length - 1]?.price ?? 0;
  const prices = product.priceHistory.map((p) => p.price);
  const minPrice = prices.length ? Math.min(...prices) : currentPrice;
  const maxPrice = prices.length ? Math.max(...prices) : currentPrice;
  const isLowest = currentPrice <= minPrice;
  const belowTarget = product.targetPrice ? currentPrice <= product.targetPrice : false;

  const hourlyRate = settings.monthlyHours > 0 ? settings.monthlyIncome / settings.monthlyHours : 30;
  const workHours = (currentPrice / hourlyRate).toFixed(1);

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      recommendation: isLowest || belowTarget ? 'Comprar agora' : 'Aguardar',
      justification: `Preço atual de R$ ${currentPrice.toFixed(2)} equivale a ${workHours} h de trabalho. Preço mínimo histórico registrado: R$ ${minPrice.toFixed(2)}.`,
      assessedAt: new Date().toISOString(),
    };
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  const prompt = `Você é um avaliador financeiro e contábil rigoroso e neutro.
Analise os dados objetivos de compra deste produto:

- Produto: ${product.name}
- Loja: ${product.store}
- Motivo da compra declarado: "${product.reason}"
- Prioridade definida: ${product.priority} (preciso / quero / desejo)
- Preço atual: R$ ${currentPrice.toFixed(2)}
- Preço-alvo desejado: ${product.targetPrice ? `R$ ${product.targetPrice.toFixed(2)}` : 'Não definido'}
- Menor preço registrado no histórico: R$ ${minPrice.toFixed(2)}
- Maior preço registrado no histórico: R$ ${maxPrice.toFixed(2)}
- Quantidade de checagens históricas: ${product.priceHistory.length}
- Custo equivalente em horas de trabalho: ${workHours} horas

Regras obrigatórias de tom e formato:
1. Responda ESTRITAMENTE em formato JSON com dois campos:
   {
     "recommendation": "Comprar agora" OU "Aguardar",
     "justification": "Texto de 2 a 3 linhas com análise contábil e factual."
   }
2. O texto deve ser estritamente neutro, factual e sem linguagem de marketing ou persuasão.
3. Sem exclamações, sem emojis, sem adjetivos apelativos. Apenas constatações numéricas e de prioridade.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    const text = response.text || '';
    let cleaned = text.trim();
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.replace(/^```json\s*/i, '');
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```\s*/, '');
    }
    if (cleaned.endsWith('```')) {
      cleaned = cleaned.replace(/\s*```$/, '');
    }

    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      cleaned = cleaned.substring(firstBrace, lastBrace + 1);
    }

    const parsed = JSON.parse(cleaned);
    const rec: 'Comprar agora' | 'Aguardar' =
      parsed.recommendation === 'Comprar agora' ? 'Comprar agora' : 'Aguardar';
    const just = typeof parsed.justification === 'string' ? parsed.justification.trim() : '';

    return {
      recommendation: rec,
      justification: just || `Preço atual de R$ ${currentPrice.toFixed(2)} equivale a ${workHours} h de trabalho.`,
      assessedAt: new Date().toISOString(),
    };
  } catch {
    const rec = isLowest || belowTarget ? 'Comprar agora' : 'Aguardar';
    return {
      recommendation: rec,
      justification: `Preço atual R$ ${currentPrice.toFixed(2)} equivale a ${workHours} h de trabalho. Menor valor registrado: R$ ${minPrice.toFixed(2)}.`,
      assessedAt: new Date().toISOString(),
    };
  }
}
