import { Product, AlertItem, PricePoint } from '../types/index.ts';

/** Três produtos com 30 dias de histórico fictício, para demonstração e prints. */
export function buildSampleData(): { products: Product[]; alerts: AlertItem[] } {
  const now = new Date();

  const generateDates = (daysAgo: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() - daysAgo);
    return d.toISOString();
  };

  const sonyHistory: PricePoint[] = [
    { date: generateDates(30), price: 1849.00, inStock: true },
    { date: generateDates(24), price: 1799.00, inStock: true },
    { date: generateDates(18), price: 1749.00, inStock: true },
    { date: generateDates(12), price: 1699.00, inStock: true },
    { date: generateDates(6), price: 1599.00, inStock: true },
    { date: generateDates(1), price: 1489.00, originalPrice: 1849.00, inStock: true },
  ];

  const kindleHistory: PricePoint[] = [
    { date: generateDates(30), price: 699.00, inStock: true },
    { date: generateDates(22), price: 699.00, inStock: true },
    { date: generateDates(15), price: 749.00, inStock: true },
    { date: generateDates(8), price: 749.00, inStock: true },
    { date: generateDates(3), price: 699.00, originalPrice: 849.00, inStock: true }, // Desconto inflado: preço "de" diz 849 mas histórico já esteve em 699
    { date: generateDates(0), price: 699.00, originalPrice: 849.00, inStock: true },
  ];

  const dellHistory: PricePoint[] = [
    { date: generateDates(30), price: 2799.00, inStock: true },
    { date: generateDates(20), price: 2699.00, inStock: true },
    { date: generateDates(14), price: 2549.00, inStock: true },
    { date: generateDates(7), price: 2499.00, inStock: true },
    { date: generateDates(0), price: 2399.00, originalPrice: 2799.00, inStock: true },
  ];

  const sampleProducts: Product[] = [
    {
      id: 'prod-sample-1',
      url: 'https://www.amazon.com.br/dp/B0863TXGM3',
      name: 'Headphone Sony WH-1000XM4 Cancelamento de Ruído Preto',
      reason: 'Fone atual com bateria desgastada para trabalho remoto',
      priority: 'preciso',
      category: 'Eletrônicos',
      store: 'Amazon',
      imageUrl: 'https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=600&auto=format&fit=crop&q=80',
      targetPrice: 1500.00,
      createdAt: generateDates(30),
      status: 'monitorando',
      priceHistory: sonyHistory,
    },
    {
      id: 'prod-sample-2',
      url: 'https://www.amazon.com.br/dp/B08N3TCP2F',
      name: 'Kindle Paperwhite 16 GB Tela de 6.8 Polegadas com Luz Ajustável',
      reason: 'Leitura diária de livros técnicos sem reflexos na vista',
      priority: 'quero',
      category: 'Livros',
      store: 'Amazon',
      imageUrl: 'https://images.unsplash.com/photo-1592496001020-d31bd830651f?w=600&auto=format&fit=crop&q=80',
      targetPrice: 650.00,
      createdAt: generateDates(30),
      status: 'monitorando',
      priceHistory: kindleHistory,
    },
    {
      id: 'prod-sample-3',
      url: 'https://www.kabum.com.br/produto/monitor-dell-27-quad-hd-165hz',
      name: 'Monitor Dell 27 Polegadas Quad HD 165Hz FreeSync Premium',
      reason: 'Segunda tela para produtividade e edição de diagramas',
      priority: 'desejo',
      category: 'Games',
      store: 'Kabum',
      imageUrl: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=600&auto=format&fit=crop&q=80',
      targetPrice: 2100.00,
      createdAt: generateDates(30),
      status: 'monitorando',
      priceHistory: dellHistory,
    },
  ];

  const sampleAlerts: AlertItem[] = [
    {
      id: 'alert-sample-1',
      date: generateDates(1),
      productId: 'prod-sample-1',
      productName: 'Headphone Sony WH-1000XM4 Cancelamento de Ruído Preto',
      event: 'Preço abaixo do alvo',
      value: 1489.00,
      oldValue: 1599.00,
      store: 'Amazon',
    },
    {
      id: 'alert-sample-2',
      date: generateDates(1),
      productId: 'prod-sample-1',
      productName: 'Headphone Sony WH-1000XM4 Cancelamento de Ruído Preto',
      event: 'Menor preço registrado',
      value: 1489.00,
      oldValue: 1599.00,
      store: 'Amazon',
    },
    {
      id: 'alert-sample-3',
      date: generateDates(7),
      productId: 'prod-sample-3',
      productName: 'Monitor Dell 27 Polegadas Quad HD 165Hz FreeSync Premium',
      event: 'Menor preço registrado',
      value: 2399.00,
      oldValue: 2499.00,
      store: 'Kabum',
    },
  ];

  return { products: sampleProducts, alerts: sampleAlerts };
}
