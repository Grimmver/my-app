import React, { useState, useEffect, useRef } from 'react';
import './shop.css';
import { fetchShopCatalog } from './services/shopApi';
import ShopHeader from './components/ShopHeader';
import HeroBanner from './components/HeroBanner';
import ProductCard from './components/ProductCard';
import ProductQuickView from './components/ProductQuickView';
import CartModal from './components/CartModal';
import AiAssistant from './components/AiAssistant';
import ShopFooter from './components/ShopFooter';

/**
 * ============================================================================
 * ГЛАВНЫЙ КОМПОНЕНТ ИНТЕРНЕТ-МАГАЗИНА AKNYET (shop/ShopApp.jsx)
 * ============================================================================
 */
export default function ShopApp() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [onlyInStock, setOnlyInStock] = useState(false);
  const [sortBy, setSortBy] = useState('default');
  const [maxPriceFilter, setMaxPriceFilter] = useState('');

  const [cart, setCart] = useState(() => {
    try {
      const saved = localStorage.getItem('aknyet_shop_cart');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isCartOpen, setIsCartOpen] = useState(false);

  const [favorites, setFavorites] = useState(() => {
    try {
      const saved = localStorage.getItem('aknyet_shop_favorites');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [showOnlyFavorites, setShowOnlyFavorites] = useState(false);

  const [quickViewProduct, setQuickViewProduct] = useState(null);
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [toast, setToast] = useState(null);

  const catalogSectionRef = useRef(null);

  useEffect(() => {
    document.title =
      'Aknyet - Продажа браслетов, свечей, феншуй товаров, сувениров и других товаров в Алматы';
    loadCatalog();
  }, []);

  useEffect(() => {
    localStorage.setItem('aknyet_shop_cart', JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    localStorage.setItem('aknyet_shop_favorites', JSON.stringify(favorites));
  }, [favorites]);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadCatalog = async () => {
    setIsLoading(true);
    try {
      const data = await fetchShopCatalog();
      setProducts(data.products || []);
      setCategories(data.categories || []);

      setCart((prevCart) =>
        prevCart
          .map((cartItem) => {
            const fresh = (data.products || []).find((p) => p.id === cartItem.id);
            if (!fresh || Number(fresh.quantity) <= 0) return null;
            return {
              ...fresh,
              cartQuantity: Math.min(cartItem.cartQuantity, Number(fresh.quantity)),
            };
          })
          .filter(Boolean)
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddToCart = (product, qtyToAdd = 1) => {
    const stock = Number(product.quantity) || 0;
    if (stock <= 0) {
      showToast(`Товар «${product.name}» нет в наличии`, 'error');
      return;
    }

    setCart((prev) => {
      const existingIndex = prev.findIndex((item) => item.id === product.id);
      if (existingIndex > -1) {
        const currentQty = prev[existingIndex].cartQuantity;
        const nextQty = Math.min(stock, currentQty + qtyToAdd);
        if (nextQty === currentQty) {
          showToast(`В корзине уже максимальное доступное количество (${stock} шт.)`, 'warning');
          return prev;
        }
        const updated = [...prev];
        updated[existingIndex] = { ...product, cartQuantity: nextQty };
        showToast(`«${product.name}» — количество в корзине: ${nextQty} шт.`);
        return updated;
      } else {
        const finalQty = Math.min(stock, qtyToAdd);
        showToast(`«${product.name}» (${finalQty} шт.) добавлен в корзину`);
        return [...prev, { ...product, cartQuantity: finalQty }];
      }
    });
  };

  const handleUpdateCartQuantity = (productId, newQty) => {
    if (newQty <= 0) {
      handleRemoveFromCart(productId);
      return;
    }
    setCart((prev) =>
      prev.map((item) => {
        if (item.id !== productId) return item;
        const maxStock = Number(item.quantity) || 1;
        return { ...item, cartQuantity: Math.min(maxStock, newQty) };
      })
    );
  };

  const handleRemoveFromCart = (productId) => {
    setCart((prev) => prev.filter((item) => item.id !== productId));
  };

  const handleClearCart = () => {
    setCart([]);
  };

  const handleToggleFavorite = (productId) => {
    setFavorites((prev) =>
      prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId]
    );
  };

  const filteredProducts = products.filter((p) => {
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch = !q || p.name?.toLowerCase().includes(q);

    const matchesCategory =
      selectedCategory === 'all' ||
      (selectedCategory === 'none' && !p.categoryId) ||
      p.categoryId === selectedCategory;

    const matchesStock = !onlyInStock || Number(p.quantity) > 0;
    const matchesFavorites = !showOnlyFavorites || favorites.includes(p.id);
    const matchesMaxPrice =
      !maxPriceFilter || Number(p.price) <= Number(maxPriceFilter);

    return (
      matchesSearch &&
      matchesCategory &&
      matchesStock &&
      matchesFavorites &&
      matchesMaxPrice
    );
  });

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    if (sortBy === 'price_asc') return (Number(a.price) || 0) - (Number(b.price) || 0);
    if (sortBy === 'price_desc') return (Number(b.price) || 0) - (Number(a.price) || 0);
    if (sortBy === 'name_asc') return (a.name || '').localeCompare(b.name || '', 'ru');
    if (sortBy === 'name_desc') return (b.name || '').localeCompare(a.name || '', 'ru');
    return 0;
  });

  const cartCount = cart.reduce((sum, item) => sum + item.cartQuantity, 0);
  const cartTotal = cart.reduce(
    (sum, item) => sum + (Number(item.price) || 0) * item.cartQuantity,
    0
  );

  const scrollToCatalog = () => {
    catalogSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="aknyet-shop-wrapper">
      {toast && (
        <div className="fixed top-20 right-5 z-50 akn-animate-in">
          <div
            className={`px-4 py-3 rounded-2xl shadow-xl border text-xs font-semibold flex items-center gap-2.5 ${
              toast.type === 'error'
                ? 'bg-red-600 text-white border-red-700'
                : toast.type === 'warning'
                ? 'bg-amber-400 text-[#2E2F38] border-amber-500'
                : 'bg-[#2E2F38] text-white border-slate-700'
            }`}
          >
            <span>{toast.type === 'error' ? '⚠️' : '🛒'}</span>
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      <ShopHeader
        products={products}
        categories={categories}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        selectedCategory={selectedCategory}
        setSelectedCategory={(catId) => {
          setSelectedCategory(catId);
          scrollToCatalog();
        }}
        cartCount={cartCount}
        cartTotal={cartTotal}
        onOpenCart={() => setIsCartOpen(true)}
        onOpenAiAssistant={() => setIsAiOpen(true)}
        onSelectProductQuickView={(p) => setQuickViewProduct(p)}
        onAddToCart={handleAddToCart}
        favorites={favorites}
        onToggleFavoritesView={() => setShowOnlyFavorites((prev) => !prev)}
        showOnlyFavorites={showOnlyFavorites}
      />

      <HeroBanner
        categories={categories}
        products={products}
        selectedCategory={selectedCategory}
        onSelectCategory={(catId) => {
          setSelectedCategory(catId);
          scrollToCatalog();
        }}
        onOpenAiAssistant={() => setIsAiOpen(true)}
        onScrollToCatalog={scrollToCatalog}
      />

      <main ref={catalogSectionRef} className="flex-1 py-6">
        <div className="akn-container space-y-6">
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#E8E9F0] shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h2 className="akn-font-rubik text-xl sm:text-2xl font-bold text-[#2E2F38] flex items-center gap-2.5">
                <span>
                  {showOnlyFavorites
                    ? '♥ Избранные товары'
                    : selectedCategory === 'all'
                    ? 'Каталог товаров магазина'
                    : categories.find((c) => c.id === selectedCategory)?.name || 'Разное'}
                </span>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-sky-50 text-[#43A4CF]">
                  {sortedProducts.length} тов.
                </span>
              </h2>
              {searchQuery && (
                <p className="text-xs text-slate-500 mt-1">
                  Результаты поиска по запросу: «<strong>{searchQuery}</strong>»{' '}
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="text-[#43A4CF] hover:underline ml-1 cursor-pointer"
                  >
                    Сбросить
                  </button>
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-[#F9F9FA] border border-[#D2D3E0] text-xs font-medium text-[#2E2F38] cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={onlyInStock}
                  onChange={(e) => setOnlyInStock(e.target.checked)}
                  className="accent-[#43A4CF] w-4 h-4 rounded"
                />
                <span>Только в наличии</span>
              </label>

              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F9F9FA] border border-[#D2D3E0] text-xs">
                <span className="text-slate-500">Цена до:</span>
                <input
                  type="number"
                  placeholder="Все ₸"
                  value={maxPriceFilter}
                  onChange={(e) => setMaxPriceFilter(e.target.value)}
                  className="w-20 bg-transparent font-semibold text-[#2E2F38] outline-none"
                />
                {maxPriceFilter && (
                  <button
                    type="button"
                    onClick={() => setMaxPriceFilter('')}
                    className="text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 hidden sm:inline">Сортировать:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-[#F9F9FA] border border-[#D2D3E0] text-xs font-medium text-[#2E2F38] outline-none focus:border-[#43A4CF] cursor-pointer"
                >
                  <option value="default">По умолчанию</option>
                  <option value="price_asc">Цена - возрастание</option>
                  <option value="price_desc">Цена - убывание</option>
                  <option value="name_asc">Название - А-Я</option>
                  <option value="name_desc">Название - Я-А</option>
                </select>
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                <div
                  key={n}
                  className="bg-white rounded-2xl p-4 border border-slate-100 h-88 animate-pulse flex flex-col justify-between"
                >
                  <div className="w-full aspect-square bg-slate-100 rounded-xl" />
                  <div className="space-y-2 mt-3">
                    <div className="h-4 bg-slate-100 rounded w-3/4" />
                    <div className="h-3 bg-slate-100 rounded w-1/2" />
                  </div>
                  <div className="h-10 bg-slate-100 rounded-xl mt-3" />
                </div>
              ))}
            </div>
          ) : sortedProducts.length === 0 ? (
            <div className="bg-white rounded-[25px] p-12 text-center border border-slate-100 space-y-4">
              <div className="text-5xl">🔍</div>
              <h3 className="akn-font-rubik text-xl font-bold text-[#2E2F38]">
                Товары по заданным параметрам не найдены
              </h3>
              <p className="text-sm text-slate-500 max-w-md mx-auto">
                Попробуйте сбросить фильтры поиска или обратитесь к нашему ИИ-помощнику, чтобы он подобрал подходящий товар из наличия.
              </p>
              <div className="flex flex-wrap justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCategory('all');
                    setOnlyInStock(false);
                    setShowOnlyFavorites(false);
                    setMaxPriceFilter('');
                  }}
                  className="px-5 py-2.5 rounded-xl bg-[#43A4CF] text-white akn-font-rubik font-semibold text-sm cursor-pointer"
                >
                  Показать все товары ({products.length})
                </button>
                <button
                  type="button"
                  onClick={() => setIsAiOpen(true)}
                  className="px-5 py-2.5 rounded-xl bg-[#FFCD24] text-[#2E2F38] akn-font-rubik font-semibold text-sm cursor-pointer"
                >
                  🤖 Спросить ИИ-помощника
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
              {sortedProducts.map((product) => {
                const category = categories.find((c) => c.id === product.categoryId);
                const inCartItem = cart.find((item) => item.id === product.id);
                return (
                  <ProductCard
                    key={product.id}
                    product={product}
                    category={category}
                    cartQuantity={inCartItem ? inCartItem.cartQuantity : 0}
                    onAddToCart={handleAddToCart}
                    onQuickView={(prod) => setQuickViewProduct(prod)}
                    isFavorite={favorites.includes(product.id)}
                    onToggleFavorite={handleToggleFavorite}
                  />
                );
              })}
            </div>
          )}
        </div>
      </main>

      <ShopFooter
        categories={categories}
        onSelectCategory={(catId) => {
          setSelectedCategory(catId);
          scrollToCatalog();
        }}
        onOpenAiAssistant={() => setIsAiOpen(true)}
        onOpenCart={() => setIsCartOpen(true)}
      />

      {quickViewProduct && (
        <ProductQuickView
          product={quickViewProduct}
          category={categories.find((c) => c.id === quickViewProduct.categoryId)}
          onClose={() => setQuickViewProduct(null)}
          onAddToCart={handleAddToCart}
        />
      )}

      <CartModal
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cartItems={cart}
        onUpdateQuantity={handleUpdateCartQuantity}
        onRemoveItem={handleRemoveFromCart}
        onClearCart={handleClearCart}
        onOrderSuccessRefreshDb={loadCatalog}
      />

      <AiAssistant
        isOpen={isAiOpen}
        onOpen={() => setIsAiOpen(true)}
        onClose={() => setIsAiOpen(false)}
        products={products}
        categories={categories}
        onAddToCart={handleAddToCart}
        onQuickView={(prod) => setQuickViewProduct(prod)}
      />
    </div>
  );
}
