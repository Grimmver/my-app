import React, { useState, useRef, useEffect } from 'react';

/**
 * ============================================================================
 * ШАПКА САЙТА И УМНАЯ ПОИСКОВАЯ СИСТЕМА (shop/components/ShopHeader.jsx)
 * ============================================================================
 * Повторяет структуру и дизайн шапки https://aknyet.kz без технических элементов склада.
 * Для клиентов отображаются только наименование, количество и цена товаров.
 */
export default function ShopHeader({
  products = [],
  categories = [],
  searchQuery,
  setSearchQuery,
  selectedCategory,
  setSelectedCategory,
  cartCount,
  cartTotal,
  onOpenCart,
  onOpenAiAssistant,
  onSelectProductQuickView,
  onAddToCart,
  favorites = [],
  onToggleFavoritesView,
  showOnlyFavorites,
}) {
  const [isPromoVisible, setIsPromoVisible] = useState(true);
  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState(false);
  const [isCatalogMenuOpen, setIsCatalogMenuOpen] = useState(false);
  const [activeInfoModal, setActiveInfoModal] = useState(null); // 'about' | 'reviews' | 'contacts' | null

  const searchRef = useRef(null);
  const catalogRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setIsSearchDropdownOpen(false);
      }
      if (catalogRef.current && !catalogRef.current.contains(e.target)) {
        setIsCatalogMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const trimmedSearch = searchQuery.trim().toLowerCase();

  const matchedProducts = trimmedSearch
    ? products.filter((p) => p.name?.toLowerCase().includes(trimmedSearch))
    : [];

  const matchedCategories = trimmedSearch
    ? categories.filter((c) => c.name?.toLowerCase().includes(trimmedSearch))
    : [];

  return (
    <>
      {/* 1. ВЕРХНИЙ ПРОМО-БАННЕР */}
      {isPromoVisible && (
        <div className="akn-promo-bar">
          <div className="akn-container flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <span className="px-2.5 py-0.5 rounded bg-white/10 text-amber-300 font-mono text-xs font-semibold">
                AKNYET
              </span>
              <span className="font-semibold tracking-wide">Полезно — не значит дорого</span>
              <span className="hidden sm:inline text-white/70">• Откройте для себя</span>
            </div>

            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={onOpenAiAssistant}
                className="akn-promo-btn cursor-pointer"
              >
                ✨ Подобрать с ИИ-помощником
              </button>
              <button
                type="button"
                onClick={() => setIsPromoVisible(false)}
                className="text-white/70 hover:text-white text-xs flex items-center gap-1 cursor-pointer"
              >
                <span>Закрыть</span>
                <span>✕</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. ОСНОВНАЯ ШАПКА САЙТА */}
      <header className="sticky top-0 z-40">
        {/* Верхняя голубая полоса */}
        <div className="akn-header-top py-2.5">
          <div className="akn-container flex flex-wrap items-center justify-between gap-3">
            {/* Левое меню */}
            <nav className="flex items-center gap-5 text-sm font-medium">
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory('all');
                  setSearchQuery('');
                  if (showOnlyFavorites) onToggleFavoritesView();
                }}
                className="text-white hover:text-amber-200 transition-colors cursor-pointer"
              >
                Главная
              </button>
              <button
                type="button"
                onClick={() => setActiveInfoModal('about')}
                className="text-white/90 hover:text-white transition-colors cursor-pointer"
              >
                О магазине
              </button>
              <button
                type="button"
                onClick={() => setActiveInfoModal('reviews')}
                className="text-white/90 hover:text-white transition-colors cursor-pointer hidden sm:inline"
              >
                Отзывы о нас
              </button>
              <button
                type="button"
                onClick={() => setActiveInfoModal('contacts')}
                className="text-white/90 hover:text-white transition-colors cursor-pointer"
              >
                Контакты
              </button>
            </nav>

            {/* Правая часть: только клиентские контакты (WhatsApp и телефон) */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <a
                  href="https://wa.me/77017972736"
                  target="_blank"
                  rel="noreferrer"
                  className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center text-white text-xs font-bold shadow-xs hover:scale-105 transition-transform"
                  title="Написать в WhatsApp"
                >
                  W
                </a>
                <a
                  href="tel:+77017972736"
                  className="font-semibold text-white hover:text-amber-200 text-sm tracking-tight"
                >
                  +7 (701) 797-27-36
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Нижняя белая часть шапки */}
        <div className="akn-header-bottom py-4">
          <div className="akn-container flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
            {/* Логотип и описание сайта Aknyet */}
            <div className="flex items-center justify-between gap-4">
              <div
                onClick={() => {
                  setSelectedCategory('all');
                  setSearchQuery('');
                }}
                className="flex items-center gap-3.5 cursor-pointer group"
              >
                <div className="w-13 h-13 rounded-2xl bg-gradient-to-br from-[#43A4CF] to-[#2b7da3] flex items-center justify-center text-white shadow-md group-hover:scale-105 transition-transform shrink-0">
                  <span className="akn-font-rubik font-bold text-2xl tracking-wider">A</span>
                </div>
                <div>
                  <div className="akn-font-rubik text-2xl font-bold text-[#2E2F38] leading-none group-hover:text-[#43A4CF] transition-colors">
                    Aknyet
                  </div>
                  <div className="text-xs text-[#4B4E54] max-w-[290px] leading-snug mt-1 line-clamp-2">
                    Продажа браслетов, свечей, феншуй товаров, сувениров и других товаров народного потребления.
                  </div>
                </div>
              </div>

              {/* Кнопка каталога с выпадающим списком категорий */}
              <div className="relative" ref={catalogRef}>
                <button
                  type="button"
                  onClick={() => setIsCatalogMenuOpen(!isCatalogMenuOpen)}
                  className="px-4 py-2.5 rounded-xl bg-[#43A4CF] hover:bg-[#338eb8] text-white akn-font-rubik font-medium text-sm flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                  <span>Каталог</span>
                </button>

                {isCatalogMenuOpen && (
                  <div className="absolute left-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 z-50 akn-animate-in">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCategory('all');
                        setIsCatalogMenuOpen(false);
                      }}
                      className={`w-full text-left px-4 py-2.5 text-sm flex items-center justify-between hover:bg-sky-50 transition-colors cursor-pointer ${
                        selectedCategory === 'all' ? 'font-bold text-[#43A4CF] bg-sky-50/60' : 'text-slate-700'
                      }`}
                    >
                      <span>Все товары каталога</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                        {products.length}
                      </span>
                    </button>

                    {categories.map((cat) => {
                      const count = products.filter((p) => p.categoryId === cat.id).length;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => {
                            setSelectedCategory(cat.id);
                            setIsCatalogMenuOpen(false);
                          }}
                          className={`w-full text-left px-4 py-2.5 text-sm flex items-center justify-between hover:bg-sky-50 transition-colors cursor-pointer ${
                            selectedCategory === cat.id ? 'font-bold text-[#43A4CF] bg-sky-50/60' : 'text-slate-700'
                          }`}
                        >
                          <span className="truncate pr-2">{cat.name}</span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* ЦЕНТР: ПОИСКОВАЯ СИСТЕМА */}
            <div className="flex-1 max-w-xl mx-auto w-full akn-search-box" ref={searchRef}>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setIsSearchDropdownOpen(false);
                }}
                className="akn-search-form"
              >
                <input
                  type="text"
                  value={searchQuery}
                  onFocus={() => setIsSearchDropdownOpen(true)}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setIsSearchDropdownOpen(true);
                  }}
                  placeholder="Найти товар"
                  className="akn-search-input"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="px-2 text-slate-400 hover:text-slate-600 text-sm cursor-pointer"
                    title="Очистить поиск"
                  >
                    ✕
                  </button>
                )}
                <button type="submit" className="akn-search-btn">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.2}
                      d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z"
                    />
                  </svg>
                  <span className="hidden sm:inline">Найти</span>
                </button>
              </form>

              {/* Выпадающий список живого поиска (только наименование, количество и цена) */}
              {isSearchDropdownOpen && trimmedSearch.length > 0 && (
                <div className="akn-search-dropdown akn-animate-in p-4">
                  {matchedProducts.length === 0 && matchedCategories.length === 0 ? (
                    <div className="text-center py-6 space-y-2">
                      <p className="text-sm text-slate-500">
                        По запросу «<strong className="text-slate-700">{searchQuery}</strong>» ничего не найдено.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setIsSearchDropdownOpen(false);
                          onOpenAiAssistant();
                        }}
                        className="text-xs font-semibold text-[#43A4CF] hover:underline cursor-pointer"
                      >
                        ✨ Попросить ИИ-помощника подобрать похожий товар
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {matchedCategories.length > 0 && (
                        <div>
                          <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                            Категории ({matchedCategories.length})
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {matchedCategories.map((cat) => (
                              <button
                                key={cat.id}
                                type="button"
                                onClick={() => {
                                  setSelectedCategory(cat.id);
                                  setIsSearchDropdownOpen(false);
                                }}
                                className="px-3 py-1 rounded-lg bg-sky-50 hover:bg-sky-100 text-[#43A4CF] text-xs font-semibold transition-colors cursor-pointer"
                              >
                                📁 {cat.name}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {matchedProducts.length > 0 && (
                        <div>
                          <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                            Товары ({matchedProducts.length})
                          </div>
                          <div className="divide-y divide-slate-100">
                            {matchedProducts.slice(0, 6).map((product) => {
                              const stock = Number(product.quantity) || 0;
                              const isAvailable = stock > 0;
                              return (
                                <div
                                  key={product.id}
                                  className="py-2.5 flex items-center justify-between gap-3 hover:bg-slate-50/80 px-2 rounded-xl transition-colors"
                                >
                                  <div
                                    onClick={() => {
                                      onSelectProductQuickView(product);
                                      setIsSearchDropdownOpen(false);
                                    }}
                                    className="flex-1 cursor-pointer min-w-0"
                                  >
                                    <div className="text-sm font-semibold text-[#2E2F38] hover:text-[#43A4CF] truncate">
                                      {product.name}
                                    </div>
                                    <div className="text-[11px] text-slate-400">
                                      Количество: {stock} шт.
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-3 shrink-0">
                                    {isAvailable ? (
                                      <span className="akn-font-rubik font-bold text-sm text-[#2E2F38]">
                                        {Number(product.price).toLocaleString('ru-RU')} тенге
                                      </span>
                                    ) : (
                                      <span className="text-xs font-bold text-[#FF604E] bg-red-50 px-2.5 py-1 rounded-lg">
                                        Нет в наличии
                                      </span>
                                    )}

                                    {isAvailable && (
                                      <button
                                        type="button"
                                        onClick={() => onAddToCart(product, 1)}
                                        className="px-2.5 py-1.5 rounded-lg bg-[#FFCD24] hover:bg-[#f3bf10] text-[#2E2F38] text-xs font-bold cursor-pointer"
                                        title="Добавить в корзину"
                                      >
                                        + В корзину
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      <div className="pt-2 border-t border-slate-100 text-center">
                        <button
                          type="button"
                          onClick={() => setIsSearchDropdownOpen(false)}
                          className="text-xs font-semibold text-[#43A4CF] hover:underline cursor-pointer"
                        >
                          Все результаты ({matchedProducts.length})
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ПРАВАЯ ЧАСТЬ: ИИ-помощник, Избранное, Корзина */}
            <div className="flex items-center justify-end gap-2.5 shrink-0">
              <button
                type="button"
                onClick={onOpenAiAssistant}
                className="px-3.5 py-2.5 rounded-xl border border-[#43A4CF]/30 bg-[#43A4CF]/10 hover:bg-[#43A4CF] text-[#43A4CF] hover:text-white akn-font-rubik font-medium text-sm flex items-center gap-2 transition-all cursor-pointer"
                title="Открыть ИИ-помощника для выбора товара"
              >
                <span className="text-base">🤖</span>
                <span className="hidden xl:inline">ИИ-помощник</span>
              </button>

              <button
                type="button"
                onClick={onToggleFavoritesView}
                className={`relative p-2.5 rounded-xl border transition-all cursor-pointer ${
                  showOnlyFavorites
                    ? 'bg-rose-50 border-rose-300 text-rose-600'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-[#43A4CF] hover:text-[#43A4CF]'
                }`}
                title="Избранные товары"
              >
                <svg className="w-5 h-5" fill={showOnlyFavorites ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.8}
                    d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                  />
                </svg>
                {favorites.length > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[#FF604E] text-white text-[11px] font-bold flex items-center justify-center">
                    {favorites.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={onOpenCart}
                className="px-4 py-2.5 rounded-xl bg-[#FFCD24] hover:bg-[#f3bf10] text-[#2E2F38] akn-font-rubik font-semibold text-sm flex items-center gap-2.5 shadow-xs transition-all cursor-pointer"
              >
                <div className="relative">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
                    />
                  </svg>
                  {cartCount > 0 && (
                    <span className="absolute -top-2 -right-2 w-4.5 h-4.5 rounded-full bg-[#2E2F38] text-white text-[10px] font-bold flex items-center justify-center">
                      {cartCount}
                    </span>
                  )}
                </div>
                <div className="text-left leading-tight">
                  <div className="text-xs font-bold">Корзина</div>
                  <div className="text-[11px] font-medium opacity-85">
                    {cartCount > 0 ? `${cartTotal.toLocaleString('ru-RU')} ₸` : 'Пусто'}
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Информационные модальные окна пунктов меню */}
      {activeInfoModal && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setActiveInfoModal(null)}
        >
          <div
            className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 akn-animate-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="akn-font-rubik text-xl font-bold text-[#2E2F38]">
                {activeInfoModal === 'about' && 'О магазине Aknyet'}
                {activeInfoModal === 'reviews' && 'Отзывы покупателей о нас'}
                {activeInfoModal === 'contacts' && 'Контакты магазина Aknyet'}
              </h3>
              <button
                type="button"
                onClick={() => setActiveInfoModal(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {activeInfoModal === 'about' && (
              <div className="text-sm text-[#4B4E54] space-y-3 leading-relaxed">
                <p>
                  <strong>Aknyet</strong> — интернет-магазин в городе Алматы. В наш ассортимент входят программные
                  свечи собственного производства на все случаи жизни, сувениры фэн-шуй, браслеты из натуральных камней
                  собственной сборки, талисманы, обереги, амулеты и товары народного потребления.
                </p>
                <p>
                  Мы заботимся о качестве каждого изделия и всегда рады помочь вам с выбором подходящего товара для
                  себя или в подарок.
                </p>
              </div>
            )}

            {activeInfoModal === 'reviews' && (
              <div className="space-y-3 text-sm">
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                  <div className="mb-1">
                    <span className="font-bold text-[#2E2F38]">Айгуль М.</span>
                  </div>
                  <p className="text-slate-600 text-xs">
                    Заказывала браслет из натуральных камней и программные свечи. Качество потрясающее, ИИ-помощник на
                    сайте помог подобрать идеальный вариант в подарок!
                  </p>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                  <div className="mb-1">
                    <span className="font-bold text-[#2E2F38]">Данияр К.</span>
                  </div>
                  <p className="text-slate-600 text-xs">
                    Удобный каталог, сразу видно наличие и актуальные цены. Очень доволен покупкой!
                  </p>
                </div>
              </div>
            )}

            {activeInfoModal === 'contacts' && (
              <div className="text-sm text-[#4B4E54] space-y-2.5">
                <p>
                  <strong>📍 Город:</strong> г. Алматы, Казахстан
                </p>
                <p>
                  <strong>📞 Телефон / WhatsApp:</strong>{' '}
                  <a href="tel:+77017972736" className="text-[#43A4CF] font-semibold hover:underline">
                    +7 (701) 797-27-36
                  </a>
                </p>
                <p>
                  <strong>🕒 Режим работы:</strong> Ежедневно с 10:00 до 20:00
                </p>
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setActiveInfoModal(null)}
                className="px-5 py-2 rounded-xl bg-[#43A4CF] text-white text-sm font-semibold cursor-pointer"
              >
                Понятно
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
