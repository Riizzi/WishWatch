import { GoogleGenAI } from '@google/genai';
import { PriceResult } from '../types/index.ts';

// Detect store from URL hostname
export function detectStoreFromUrl(url: string): string {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    if (hostname.includes('amazon')) return 'Amazon';
    if (hostname.includes('mercadolivre') || hostname.includes('mercadolivre.com') || hostname.includes('mlb.')) return 'Mercado Livre';
    if (hostname.includes('magazineluiza') || hostname.includes('magalu')) return 'Magalu';
    if (hostname.includes('kabum')) return 'Kabum';
    if (hostname.includes('shopee')) return 'Shopee';
    if (hostname.includes('submarino')) return 'Submarino';
    if (hostname.includes('americanas')) return 'Americanas';
    if (hostname.includes('aliexpress')) return 'AliExpress';
    
    // Fallback: extract domain name
    const parts = hostname.replace(/^www\./, '').split('.');
    if (parts.length > 0 && parts[0]) {
      return parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
    }
    return 'Outra';
  } catch {
    return 'Outra';
  }
}

function sanitizeJsonString(text: string): string {
  // Remove markdown code fences ```json ... ```
  let cleaned = text.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/i, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/, '');
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.replace(/\s*```$/, '');
  }

  // Find first { and last }
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }
  return cleaned;
}

export async function checkPrice(url: string): Promise<PriceResult> {
  const storeGuess = detectStoreFromUrl(url);

  // Validate URL format
  try {
    new URL(url);
  } catch {
    return {
      name: '',
      price: null,
      originalPrice: null,
      currency: 'BRL',
      store: storeGuess,
      inStock: false,
      confidence: 0,
      uncertain: true,
      rawText: 'Link inválido',
    };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      name: `Produto (${storeGuess})`,
      price: null,
      originalPrice: null,
      currency: 'BRL',
      store: storeGuess,
      inStock: true,
      confidence: 0,
      uncertain: true,
      rawText: 'Chave de API não configurada',
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

  const prompt = `Analise a página do produto informada na URL a seguir:
URL: ${url}
Loja identificada: ${storeGuess}

Objetivo: Extraia os dados contábeis atuais deste produto.
Responda exclusivamente com um JSON puro no formato abaixo, sem texto antes ou depois:
{
  "name": "Nome completo e oficial do produto",
  "price": 0.00, // número float em Reais (BRL). Se indisponível ou não localizado, retorne null
  "originalPrice": 0.00, // número float do preço anterior "de:" se houver, ou null
  "currency": "BRL",
  "store": "${storeGuess}",
  "imageUrl": "URL direta da imagem do produto ou null",
  "inStock": true, // boolean indicando se está disponível para compra
  "category": "Eletrônicos", // Uma entre: "Eletrônicos", "Casa", "Roupas", "Games", "Livros", "Outros"
  "confidence": 0.95 // Confiança entre 0.0 e 1.0 na precisão do valor encontrado
}

Se não puder acessar o conteúdo exato diretamente, pesquise o produto correspondente a essa URL para coletar o preço atual praticado.
Se houver dúvida ou divergência no valor, utilize confidence menor que 0.6.`;

  // 1ª tentativa: urlContext lê a página; googleSearch cobre lojas que bloqueiam a leitura.
  // Essas ferramentas não aceitam responseSchema, então o JSON é pedido no prompt.
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        tools: [{ urlContext: {} }, { googleSearch: {} }],
      },
    });

    const responseText = response.text || '';
    const cleaned = sanitizeJsonString(responseText);
    const parsed = JSON.parse(cleaned);

    const priceNum = typeof parsed.price === 'number' && !isNaN(parsed.price) && parsed.price > 0 ? parsed.price : null;
    const origPriceNum = typeof parsed.originalPrice === 'number' && !isNaN(parsed.originalPrice) && parsed.originalPrice > 0 ? parsed.originalPrice : null;
    const conf = typeof parsed.confidence === 'number' ? parsed.confidence : (priceNum ? 0.8 : 0.4);
    const uncertain = conf < 0.6 || priceNum === null;

    return {
      name: (parsed.name || `Produto em ${storeGuess}`).trim(),
      price: priceNum,
      originalPrice: origPriceNum,
      currency: parsed.currency || 'BRL',
      store: parsed.store || storeGuess,
      imageUrl: parsed.imageUrl || undefined,
      inStock: typeof parsed.inStock === 'boolean' ? parsed.inStock : true,
      category: parsed.category || 'Outros',
      confidence: conf,
      uncertain,
      rawText: responseText,
    };
  } catch (err: any) {
    // If tools or search hit error or parse failed, try standard fallback without tools
    try {
      const responseFallback = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `${prompt}\n(Nota: Se a URL direta não for acessível, analise o identificador ou slug na própria URL: ${url})`,
      });

      const fallbackText = responseFallback.text || '';
      const fallbackCleaned = sanitizeJsonString(fallbackText);
      const parsed = JSON.parse(fallbackCleaned);

      const priceNum = typeof parsed.price === 'number' && !isNaN(parsed.price) && parsed.price > 0 ? parsed.price : null;
      const origPriceNum = typeof parsed.originalPrice === 'number' && !isNaN(parsed.originalPrice) && parsed.originalPrice > 0 ? parsed.originalPrice : null;
      const conf = typeof parsed.confidence === 'number' ? Math.min(parsed.confidence, 0.55) : 0.4;

      return {
        name: (parsed.name || `Produto em ${storeGuess}`).trim(),
        price: priceNum,
        originalPrice: origPriceNum,
        currency: 'BRL',
        store: parsed.store || storeGuess,
        imageUrl: parsed.imageUrl || undefined,
        inStock: typeof parsed.inStock === 'boolean' ? parsed.inStock : true,
        category: parsed.category || 'Outros',
        confidence: conf,
        uncertain: true,
        rawText: fallbackText,
      };
    } catch (fallbackErr: any) {
      const isRateLimit = String(err?.message || '').includes('429') || String(fallbackErr?.message || '').includes('429');
      return {
        name: `Produto em ${storeGuess}`,
        price: null,
        originalPrice: null,
        currency: 'BRL',
        store: storeGuess,
        inStock: true,
        confidence: 0,
        uncertain: true,
        rawText: isRateLimit
          ? 'Limite de requisições atingido. Tente novamente em alguns minutos'
          : 'Não foi possível ler esta página',
      };
    }
  }
}
