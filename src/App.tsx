import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Product, UserSettings, AlertItem, Priority, ProductStatus, ServerHealth } from './types/index.ts';
import { initSync, SyncStatus } from './services/sync.ts';
import { storage, DEFAULT_SETTINGS } from './services/storage.ts';
import { checkSingleProduct } from './services/monitor.ts';
import { Header } from './components/Header.tsx';
import { LedgerSummary } from './components/LedgerSummary.tsx';
import { ProductCard } from './components/ProductCard.tsx';
import { ProductDetailModal } from './components/ProductDetailModal.tsx';
import { AddProductModal } from './components/AddProductModal.tsx';
import { BuyPromptModal } from './components/BuyPromptModal.tsx';
import { AlertsDrawer } from './components/AlertsDrawer.tsx';
import { SettingsModal } from './components/SettingsModal.tsx';
import { Plus, ArrowUpDown, Inbox, Search, RefreshCw } from 'lucide-react';

type SortOption = 'maior_queda' | 'menor_preco' | 'mais_recente' | 'prioridade';

const STATUS_TABS: { id: 'todos' | ProductStatus; label: string }[] = [
  { id: 'monitorando', label: 'Monitorando' },
  { id: 'comprado', label: 'Comprados' },
  { id: 'arquivado', label: 'Arquivados' },
  { id: 'todos', label: 'Todos' },
];

export default function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('local');
  const [health, setHealth] = useState<ServerHealth | null>(null);
  const [pendingProductId, setPendingProductId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);

  // UI state
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [buyingProduct, setBuyingProduct] = useState<Product | null>(null);
  const [isAlertsOpen, setIsAlertsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Filter & Sort state
  const [statusFilter, setStatusFilter] = useState<'todos' | ProductStatus>('monitorando');
  const [priorityFilter, setPriorityFilter] = useState<'todas' | Priority>('todas');
  const [categoryFilter, setCategoryFilter] = useState<string>('todas');
  const [storeFilter, setStoreFilter] = useState<string>('todas');
  const [sortBy, setSortBy] = useState<SortOption>('maior_queda');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Monitoring state
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [isRefreshingAll, setIsRefreshingAll] = useState(false);
  const [refreshProgress, setRefreshProgress] = useState<string | null>(null);

  const initialCheckPerformed = useRef(false);

  // Refs com o estado mais recente: evitam closures desatualizadas no setInterval
  const productsRef = useRef<Product[]>([]);
  const settingsRef = useRef<UserSettings>(DEFAULT_SETTINGS);
  const refreshingAllRef = useRef(false);
  productsRef.current = products;
  settingsRef.current = settings;

  // Load initial data
  const loadData = async () => {
    try {
      const state = await storage.getState();
      setProducts(state.products);
      setSettings(state.settings);
      setAlerts(state.alerts);
      setLoadError(null);
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
      setLoadError(err instanceof Error ? err.message : 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    initSync()
      .then(({ status, health }) => {
        setSyncStatus(status);
        setHealth(health);
      })
      .finally(loadData);
  }, []);

  // Abre o produto indicado na URL (?product=id), usado pelas notificações
  const openProductFromUrl = (href: string) => {
    try {
      const id = new URL(href, window.location.origin).searchParams.get('product');
      if (id) setPendingProductId(id);
    } catch {
      // URL inválida
    }
  };

  useEffect(() => {
    openProductFromUrl(window.location.href);
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === 'open-url') {
        openProductFromUrl(event.data.url);
        loadData();
      }
    };
    navigator.serviceWorker?.addEventListener('message', onMessage);
    return () => navigator.serviceWorker?.removeEventListener('message', onMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!pendingProductId || loading) return;
    const found = products.find((p) => p.id === pendingProductId);
    if (found) setSelectedProduct(found);
    setPendingProductId(null);
    window.history.replaceState(null, '', window.location.pathname);
  }, [pendingProductId, loading, products]);

  // Recarrega ao voltar para o app (o monitoramento pode ter atualizado os preços)
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && storage.isRemote() && !refreshingAllRef.current) {
        loadData();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Checa todos os produtos em fila, um por vez, com pausa entre as requisições
  const handleRefreshAll = async () => {
    if (refreshingAllRef.current) return;
    const activeProducts = productsRef.current.filter((p) => p.status === 'monitorando');
    if (activeProducts.length === 0) return;

    refreshingAllRef.current = true;
    setIsRefreshingAll(true);

    for (let i = 0; i < activeProducts.length; i++) {
      // Pega a versão mais recente do produto (pode ter sido editado durante a fila)
      const prod = productsRef.current.find((p) => p.id === activeProducts[i].id);
      if (!prod || prod.status !== 'monitorando') continue;

      setRefreshProgress(`Verificando ${i + 1} de ${activeProducts.length}`);
      setRefreshingId(prod.id);

      try {
        const { product: updated } = await checkSingleProduct(prod, settingsRef.current);
        setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
        setSelectedProduct((sel) => (sel?.id === updated.id ? updated : sel));
      } catch (err) {
        console.error(`Erro ao verificar produto ${prod.id}:`, err);
      }

      if (i < activeProducts.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    }

    const updatedSettings = { ...settingsRef.current, lastCheckedAt: new Date().toISOString() };
    setSettings(updatedSettings);
    await storage.saveSettings(updatedSettings);
    if (storage.isRemote()) {
      await loadData();
    } else {
      setAlerts((await storage.getState()).alerts);
    }

    setRefreshingId(null);
    setRefreshProgress(null);
    setIsRefreshingAll(false);
    refreshingAllRef.current = false;
  };

  // Ao abrir: checa tudo se a última checagem foi há mais tempo que o intervalo
  useEffect(() => {
    if (loading || initialCheckPerformed.current) return;
    initialCheckPerformed.current = true;

    const last = settings.lastCheckedAt ? new Date(settings.lastCheckedAt).getTime() : 0;
    const hoursSince = (Date.now() - last) / (1000 * 60 * 60);
    if (hoursSince >= (settings.checkIntervalHours || 6)) {
      handleRefreshAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  // Rechecagem periódica enquanto o app estiver aberto
  useEffect(() => {
    const intervalMs = (settings.checkIntervalHours || 6) * 60 * 60 * 1000;
    const interval = setInterval(() => {
      handleRefreshAll();
    }, intervalMs);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.checkIntervalHours]);

  // Check single product
  const handleRefreshSingle = async (productToRefresh: Product, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (refreshingId || refreshingAllRef.current) return;

    setRefreshingId(productToRefresh.id);
    try {
      const { product: updated, alerts: updatedAlerts } = await checkSingleProduct(productToRefresh, settings);
      setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      if (selectedProduct?.id === updated.id) {
        setSelectedProduct(updated);
      }
      if (updatedAlerts.length) setAlerts((prev) => [...updatedAlerts, ...prev].slice(0, 100));
    } catch (err) {
      console.error('Erro ao atualizar produto:', err);
    } finally {
      setRefreshingId(null);
    }
  };

  const openAdd = () => {
    setEditingProduct(null);
    setIsAddOpen(true);
  };

  const showToast = (message: string) => {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3500);
  };

  /** Executa uma operação de dados e mostra um aviso se ela falhar. */
  const safely = async (fn: () => Promise<void>, errorMessage = 'Não foi possível salvar. Verifique a conexão.') => {
    try {
      await fn();
      return true;
    } catch (err) {
      console.error(err);
      showToast(errorMessage);
      return false;
    }
  };

  // Product mutations
  const handleSaveProduct = async (product: Product) => {
    const ok = await safely(() => storage.save(product));
    if (!ok) return;
    setProducts((prev) => {
      const exists = prev.some((p) => p.id === product.id);
      return exists ? prev.map((p) => (p.id === product.id ? product : p)) : [product, ...prev];
    });
    if (selectedProduct?.id === product.id) {
      setSelectedProduct(product);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!(await safely(() => storage.delete(id)))) return;
    setProducts((prev) => prev.filter((p) => p.id !== id));
    if (selectedProduct?.id === id) {
      setSelectedProduct(null);
    }
  };

  const handleConfirmPurchase = async (paidPrice: number) => {
    if (!buyingProduct) return;
    const updated: Product = {
      ...buyingProduct,
      status: 'comprado',
      paidPrice,
    };
    if (!(await safely(() => storage.update(updated)))) return;
    setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    if (selectedProduct?.id === updated.id) {
      setSelectedProduct(updated);
    }
    setBuyingProduct(null);
  };

  // Distinct categories and stores for filters
  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => p.category && set.add(p.category));
    return Array.from(set);
  }, [products]);

  const availableStores = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => p.store && set.add(p.store));
    return Array.from(set);
  }, [products]);

  // Filtered & Sorted products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      // Status
      if (statusFilter !== 'todos' && p.status !== statusFilter) return false;
      // Prioridade
      if (priorityFilter !== 'todas' && p.priority !== priorityFilter) return false;
      // Categoria
      if (categoryFilter !== 'todas' && p.category !== categoryFilter) return false;
      // Loja
      if (storeFilter !== 'todas' && p.store !== storeFilter) return false;
      // Busca
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchName = p.name.toLowerCase().includes(query);
        const matchReason = p.reason.toLowerCase().includes(query);
        const matchStore = p.store.toLowerCase().includes(query);
        if (!matchName && !matchReason && !matchStore) return false;
      }
      return true;
    }).sort((a, b) => {
      const priceA = a.priceHistory[a.priceHistory.length - 1]?.price || 0;
      const priceB = b.priceHistory[b.priceHistory.length - 1]?.price || 0;
      const initialA = a.priceHistory[0]?.price || priceA;
      const initialB = b.priceHistory[0]?.price || priceB;

      const dropA = initialA > 0 ? ((initialA - priceA) / initialA) * 100 : 0;
      const dropB = initialB > 0 ? ((initialB - priceB) / initialB) * 100 : 0;

      switch (sortBy) {
        case 'maior_queda':
          return dropB - dropA;
        case 'menor_preco':
          return priceA - priceB;
        case 'mais_recente':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'prioridade': {
          const rank = { preciso: 3, quero: 2, desejo: 1 };
          return rank[b.priority] - rank[a.priority];
        }
        default:
          return 0;
      }
    });
  }, [products, statusFilter, priorityFilter, categoryFilter, storeFilter, sortBy, searchQuery]);

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#292524] pb-24 selection:bg-[#E8DFD1]">
      {/* Header */}
      <Header
        onOpenAdd={openAdd}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenAlerts={() => setIsAlertsOpen(true)}
        onRefreshAll={handleRefreshAll}
        isRefreshingAll={isRefreshingAll}
        alertCount={alerts.length}
      />

      {/* Main container */}
      <main className="max-w-4xl mx-auto px-3 sm:px-4 pt-2">
        {/* Banner de progresso da rechecagem */}
        {refreshProgress && (
          <div role="status"
            className="mt-3 p-2.5 rounded-xl bg-[#FFFDF9] border border-[#E8DFD1] text-xs font-mono-ledger text-[#57534E] flex items-center justify-between">
            <span className="flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              {refreshProgress}
            </span>
                      </div>
        )}

        {syncStatus === 'available' && (
          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className="mt-3 w-full text-left p-3 rounded-xl bg-[#FFFDF9] border border-[#E8DFD1] text-xs text-[#57534E] flex items-center justify-between gap-3"
          >
            <span>
              <strong className="text-[#292524]">Sincronização disponível.</strong> Informe a chave de acesso para
              ativar o monitoramento 24/7 e as notificações.
            </span>
            <span className="font-mono-ledger uppercase text-[10px] text-[#292524] shrink-0">Configurar</span>
          </button>
        )}

        {loadError && (
          <div
            role="alert"
            className="mt-3 p-3 rounded-xl bg-[#FDF2F0] border border-[#F1B8AF] text-xs text-[#991B1B] flex items-center justify-between gap-3"
          >
            <span>Não foi possível carregar os dados do servidor.</span>
            <button type="button" onClick={loadData} className="font-mono-ledger uppercase text-[10px] underline">
              Tentar de novo
            </button>
          </div>
        )}

        {/* Resumo contábil do topo */}
        <LedgerSummary products={products} />

        {/* Barra de Filtros e Status */}
        <div className="mb-4">
          {/* Abas de status (estilo pasta de arquivo) */}
          <div
            role="tablist"
            aria-label="Status"
            className="flex items-end gap-1 overflow-x-auto border-b border-[#292524] -mx-3 px-3 sm:mx-0 sm:px-0"
          >
            {STATUS_TABS.map((tab) => {
              const count =
                tab.id === 'todos' ? products.length : products.filter((p) => p.status === tab.id).length;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={statusFilter === tab.id}
                  onClick={() => setStatusFilter(tab.id)}
                  className="status-tab -mb-px"
                >
                  {tab.label} <span className="opacity-60">{count}</span>
                </button>
              );
            })}
          </div>

          {/* Filtros secundários e ordenação */}
          <div className="retro-card rounded-tl-none rounded-tr-none sm:rounded-tr-[14px] border-t-0 p-3 flex flex-wrap items-center justify-between gap-2">
            {/* Campo de busca */}
            <div className="relative w-full sm:w-auto flex-1 min-w-[160px]">
              <Search className="w-4 h-4 text-[#A8A29E] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                placeholder="Buscar por nome, loja ou motivo"
                aria-label="Buscar"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="ledger-input pl-9"
              />
            </div>

            <div className="grid grid-cols-2 sm:flex items-center gap-2 w-full sm:w-auto">
              {/* Prioridade */}
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value as any)}
                className="flex-1 sm:flex-none min-w-0 min-h-10 bg-[#FAF7F2] border border-[#E8DFD1] rounded-xl px-2 text-[11px] text-[#57534E] font-mono-ledger uppercase focus:outline-none focus:border-[#292524]"
              >
                <option value="todas">Prioridade</option>
                <option value="preciso">Preciso</option>
                <option value="quero">Quero</option>
                <option value="desejo">Desejo</option>
              </select>

              {/* Categoria */}
              {availableCategories.length > 0 && (
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="flex-1 sm:flex-none min-w-0 min-h-10 bg-[#FAF7F2] border border-[#E8DFD1] rounded-xl px-2 text-[11px] text-[#57534E] font-mono-ledger uppercase focus:outline-none focus:border-[#292524]"
                >
                  <option value="todas">Categoria</option>
                  {availableCategories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              )}

              {/* Loja */}
              {availableStores.length > 0 && (
                <select
                  value={storeFilter}
                  onChange={(e) => setStoreFilter(e.target.value)}
                  className="flex-1 sm:flex-none min-w-0 min-h-10 bg-[#FAF7F2] border border-[#E8DFD1] rounded-xl px-2 text-[11px] text-[#57534E] font-mono-ledger uppercase focus:outline-none focus:border-[#292524]"
                >
                  <option value="todas">Loja</option>
                  {availableStores.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              )}

              {/* Ordenar por */}
              <label className="flex flex-1 sm:flex-none items-center gap-1 min-h-10 bg-[#FAF7F2] border border-[#E8DFD1] rounded-xl px-2">
                <ArrowUpDown className="w-3 h-3 text-[#78716C]" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  aria-label="Ordenar"
                  className="bg-transparent text-[11px] text-[#292524] font-mono-ledger uppercase focus:outline-none min-w-0 w-full"
                >
                  <option value="maior_queda">Maior queda</option>
                  <option value="menor_preco">Menor preço</option>
                  <option value="mais_recente">Mais recente</option>
                  <option value="prioridade">Prioridade</option>
                </select>
              </label>
            </div>
          </div>
        </div>

        {/* Lista de Produtos */}
        {filteredProducts.length === 0 ? (
          products.length === 0 ? (
            <div className="retro-card px-6 py-12 text-center my-6">
              <Inbox className="w-10 h-10 text-[#A8A29E] mx-auto mb-3" strokeWidth={1.25} />
              <h3 className="font-semibold text-base text-[#292524]">Nenhum produto cadastrado</h3>
              <p className="text-xs text-[#78716C] max-w-sm mx-auto mt-1 mb-5 leading-relaxed">
                Cole o link de um produto de qualquer loja para registrar o preço e acompanhar as variações.
              </p>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2">
                <button type="button" onClick={openAdd} className="retro-btn retro-btn-primary text-xs">
                  <Plus className="w-4 h-4" />
                  Adicionar produto
                </button>
                <button
                  type="button"
                  onClick={() => safely(() => storage.loadSampleData()).then(loadData)}
                  className="retro-btn text-xs"
                >
                  Carregar exemplo
                </button>
              </div>
            </div>
          ) : (
            <div className="px-6 py-12 text-center my-4 text-xs font-mono-ledger text-[#78716C]">
              Nenhum produto neste filtro.
            </div>
          )
        ) : (
          <div className="space-y-3">
            {filteredProducts.map((prod) => (
              <ProductCard
                key={prod.id}
                product={prod}
                settings={settings}
                onClick={() => setSelectedProduct(prod)}
                onRefresh={(e) => handleRefreshSingle(prod, e)}
                isRefreshing={refreshingId === prod.id}
              />
            ))}
          </div>
        )}
      </main>

      {/* Botão flutuante '+' no mesmo estilo dos cards (fundo off-white, borda argila, sombra sólida) */}
      <button
        type="button"
        onClick={openAdd}
        className="retro-fab fixed right-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-40 sm:hidden"
        title="Adicionar produto"
        aria-label="Adicionar produto"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* Modais */}
      {/* 1. Modal Detalhe do Produto */}
      {selectedProduct && (
        <ProductDetailModal
          product={selectedProduct}
          settings={settings}
          onClose={() => setSelectedProduct(null)}
          onUpdate={handleSaveProduct}
          onDelete={handleDeleteProduct}
          onOpenBuyPrompt={(prod) => setBuyingProduct(prod)}
          onEdit={(prod) => {
            setEditingProduct(prod);
            setIsAddOpen(true);
          }}
          onRefreshPrice={(prod) => handleRefreshSingle(prod)}
          isRefreshing={refreshingId === selectedProduct.id}
        />
      )}

      {/* 2. Modal Adicionar / Editar */}
      {isAddOpen && (
        <AddProductModal
          initialProduct={editingProduct}
          onClose={() => {
            setIsAddOpen(false);
            setEditingProduct(null);
          }}
          onSave={handleSaveProduct}
        />
      )}

      {/* 3. Modal Marcar como Comprado */}
      {buyingProduct && (
        <BuyPromptModal
          product={buyingProduct}
          onClose={() => setBuyingProduct(null)}
          onConfirm={handleConfirmPurchase}
        />
      )}

      {/* 4. Drawer de Alertas */}
      {isAlertsOpen && (
        <AlertsDrawer
          alerts={alerts}
          onClose={() => setIsAlertsOpen(false)}
          onClearAlerts={async () => {
            if (await safely(() => storage.clearAlerts())) setAlerts([]);
          }}
          onSelectProduct={(productId) => {
            const found = products.find((p) => p.id === productId);
            if (found) setSelectedProduct(found);
          }}
        />
      )}

      {/* 5. Modal de Configurações */}
      {isSettingsOpen && (
        <SettingsModal
          settings={settings}
          onClose={() => setIsSettingsOpen(false)}
          onSaveSettings={async (updated) => {
            if (await safely(() => storage.saveSettings(updated))) setSettings(updated);
          }}
          onReloadData={loadData}
          syncStatus={syncStatus}
          health={health}
          onSyncStatusChange={(status) => {
            setSyncStatus(status);
            loadData();
          }}
        />
      )}

      {toast && (
        <div
          role="status"
          className="fixed left-1/2 -translate-x-1/2 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] sm:bottom-6 z-[60] max-w-[calc(100%-2rem)] px-4 py-2.5 rounded-xl bg-[#292524] text-[#FAF7F2] text-xs font-mono-ledger shadow-[2px_2px_0_#E5DCD0]"
        >
          {toast}
        </div>
      )}
    </div>
  );
}
