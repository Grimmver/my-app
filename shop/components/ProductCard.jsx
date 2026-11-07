import React, { useState } from 'react';

/**
 * ============================================================================
 * КАРТОЧКА ТОВАРА В СТИЛЕ AKNYET.KZ (shop/components/ProductCard.jsx)
 * ============================================================================
 * Для покупателя отображаются только:
 * - Наименование товара
 * - Количество в наличии и выбор количества для покупки
 * - Цена (а если товара нет в наличии — вместо цены выводится «Нет в наличии»)
 */

function getProductVisual(name = '', categoryName = '') {
  const text = `${name} ${categoryName}`.toLowerCase();

  if (text.includes('свеч') || text.includes('воск') || text.includes('алтар')) {
    return { emoji: '🕯️', bg: 'from-amber-50 via-orange-50 to-yellow-100' };
  }
  if (text.includes('браслет') || text.includes('камн') || text.includes('бусин') || text.includes('нить')) {
    return { emoji: '📿', bg: 'from-sky-50 via-cyan-50 to-blue-100' };
  }
  if (
    text.includes('дзи') ||
    text.includes('талисман') ||
    text.includes('оберег') ||
    text.includes('амулет') ||
    text.includes('фен') ||
    text.includes('фэн')
  ) {
    return { emoji: '🔮', bg: 'from-purple-50 via-indigo-50 to-violet-100' };
  }
  if (text.includes('трав') || text.includes('благовон') || text.includes('аромат') || text.includes('масл')) {
    return { emoji: '🌿', bg: 'from-emerald-50 via-teal-50 to-green-100' };
  }
  if (text.includes('сувенир') || text.includes('подар')) {
    return { emoji: '🎁', bg: 'from-rose-50 via-pink-50 to-amber-50' };
  }
  return { emoji: '🛍️', bg: 'from-slate-50 via-sky-50/60 to-slate-100' };
}

function parseImages(imagesRaw) {
  if (!imagesRaw) return [];
  if (Array.isArray(imagesRaw)) return imagesRaw.filter(Boolean);
  if (typeof imagesRaw === 'string') {
    const trimmed = imagesRaw.trim();
    if (!trimmed || trimmed === '[]') return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed.filter(Boolean);
    } catch {
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return [trimmed];
    }
  }
  return [];
}

export default function ProductCard({
  product,
  category,
  cartQuantity = 0,
  onAddToCart,
  onQuickView,
  isFavorite = false,
  onToggleFavorite,
}) {
  const [selectedQty, setSelectedQty] = useState(1);

  const stock = Number(product.quantity) || 0;
  const isAvailable = stock > 0;
  const visual = getProductVisual(product.name, category?.name);
  const productImages = parseImages(product.images);

  const handleDecrease = () => {
    setSelectedQty((prev) => Math.max(1, prev - 1));
  };

  const handleIncrease = () => {
    setSelectedQty((prev) => Math.min(stock, prev + 1));
  };

  const handleAddClick = (e) => {
    e.preventDefault();
    if (!isAvailable) return;
    onAddToCart(product, selectedQty);
    setSelectedQty(1);
  };

  return (
    <article className="akn-product-card group">
      {/* Верхняя часть карточки: иллюстрация + избранное + быстрый просмотр */}
      <div>
        <div className={`akn-product-image-wrap bg-gradient-to-br ${visual.bg}`}>
          {category && (
            <span className="absolute top-3 left-3 z-10 px-2.5 py-1 rounded-lg bg-white/90 backdrop-blur-xs text-[11px] font-semibold text-[#2E2F38] shadow-2xs">
              {category.name}
            </span>
          )}

          <button
            type="button"
            onClick={() => onToggleFavorite && onToggleFavorite(product.id)}
            className={`absolute top-3 right-3 z-10 w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-2xs ${
              isFavorite
                ? 'bg-rose-500 text-white'
                : 'bg-white/85 hover:bg-white text-slate-400 hover:text-rose-500'
            }`}
            title={isFavorite ? 'Убрать из избранного' : 'В избранное'}
          >
            ♥
          </button>

          <div
            onClick={() => onQuickView && onQuickView(product)}
            className={`w-full h-full flex items-center justify-center cursor-pointer select-none ${
              productImages.length > 0 ? 'p-0' : 'p-6'
            }`}
          >
            {productImages.length > 0 ? (
              <img
                src={productImages[0]}
                alt={product.name}
                className={`w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 ${
                  !isAvailable ? 'grayscale opacity-50' : ''
                }`}
              />
            ) : (
              <div
                className={`text-5xl sm:text-6xl transition-transform duration-300 group-hover:scale-110 ${
                  !isAvailable ? 'grayscale opacity-50' : ''
                }`}
              >
                {visual.emoji}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => onQuickView && onQuickView(product)}
            className="akn-quick-view-btn"
          >
            👁 Быстрый просмотр
          </button>
        </div>

        {/* Количество в наличии и наименование товара */}
        <div className="p-4 pb-2 space-y-2">
          <div className="flex items-center">
            {isAvailable ? (
              <div className="akn-stock-badge in-stock">
                <span className="w-2 h-2 rounded-full bg-[#5ABF70]" />
                <span>
                  В наличии: <ins className="no-underline font-bold">{stock}</ins> шт.
                </span>
              </div>
            ) : (
              <div className="akn-stock-badge out-of-stock">
                <span className="w-2 h-2 rounded-full bg-[#FF604E]" />
                <span>Количество: 0 шт.</span>
              </div>
            )}
          </div>

          <h3
            onClick={() => onQuickView && onQuickView(product)}
            className="akn-font-rubik font-semibold text-[15px] text-[#2E2F38] hover:text-[#43A4CF] leading-snug cursor-pointer line-clamp-2 min-h-[42px] transition-colors"
            title={product.name}
          >
            {product.name}
          </h3>
        </div>
      </div>

      {/* Нижняя часть карточки: цена (или «Нет в наличии») + выбор кол-ва и кнопка «В корзину» */}
      <div className="p-4 pt-2 border-t border-slate-100/80 mt-1 space-y-3">
        <div className="min-h-[34px] flex items-center justify-between">
          {isAvailable ? (
            <div className="flex items-baseline gap-1.5">
              <strong className="akn-font-rubik text-xl font-bold text-[#2E2F38]">
                {Number(product.price).toLocaleString('ru-RU')}
              </strong>
              <span className="text-xs font-medium text-[#4B4E54]">тенге</span>
            </div>
          ) : (
            <div className="w-full py-1.5 px-3 rounded-xl bg-red-50 border border-red-200/80 text-[#FF604E] akn-font-rubik font-bold text-sm text-center">
              Нет в наличии
            </div>
          )}
        </div>

        {isAvailable ? (
          <div className="flex items-center gap-2">
            <div className="akn-qty-control shrink-0">
              <button
                type="button"
                onClick={handleDecrease}
                disabled={selectedQty <= 1}
                className="akn-qty-btn"
                title="Уменьшить количество"
              >
                −
              </button>
              <input
                type="text"
                readOnly
                value={selectedQty}
                className="akn-qty-input"
              />
              <button
                type="button"
                onClick={handleIncrease}
                disabled={selectedQty >= stock}
                className="akn-qty-btn"
                title="Увеличить количество"
              >
                +
              </button>
            </div>

            <button
              type="button"
              onClick={handleAddClick}
              className="akn-buy-btn flex-1"
            >
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
              <span className="truncate">
                {cartQuantity > 0 ? `В корзине (${cartQuantity})` : 'В корзину'}
              </span>
            </button>
          </div>
        ) : (
          <button type="button" disabled className="akn-buy-btn w-full">
            Временно отсутствует
          </button>
        )}
      </div>
    </article>
  );
}
