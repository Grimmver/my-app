import React, { useState } from 'react';

/**
 * ============================================================================
 * МОДАЛЬНОЕ ОКНО БЫСТРОГО ПРОСМОТРА ТОВАРА (shop/components/ProductQuickView.jsx)
 * ============================================================================
 * Отображает для покупателя только наименование, количество и цену.
 */
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

export default function ProductQuickView({
  product,
  category,
  onClose,
  onAddToCart,
}) {
  const [qty, setQty] = useState(1);
  const [activeImgIdx, setActiveImgIdx] = useState(0);

  if (!product) return null;

  const stock = Number(product.quantity) || 0;
  const isAvailable = stock > 0;
  const productImages = parseImages(product.images);
  const safeIdx = productImages.length > 0 ? Math.min(activeImgIdx, productImages.length - 1) : 0;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-[25px] max-w-2xl w-full overflow-hidden shadow-2xl akn-animate-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="grid grid-cols-1 md:grid-cols-12">
          {/* Иллюстрация / Фото товара слева */}
          <div className="md:col-span-5 bg-gradient-to-br from-sky-50 via-slate-50 to-amber-50 p-4 flex flex-col items-center justify-center relative min-h-[240px]">
            {category && (
              <span className="absolute top-4 left-4 z-10 px-3 py-1 rounded-full bg-white text-xs font-bold text-[#43A4CF] shadow-2xs">
                {category.name}
              </span>
            )}
            {productImages.length > 0 ? (
              <div className="w-full space-y-2.5">
                <div className="w-full h-52 rounded-2xl overflow-hidden bg-white border border-slate-100 flex items-center justify-center">
                  <img
                    src={productImages[safeIdx]}
                    alt={product.name}
                    className="w-full h-full object-contain"
                  />
                </div>
                {productImages.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto pb-1 justify-center">
                    {productImages.map((imgUrl, idx) => (
                      <button
                        key={`${imgUrl}-${idx}`}
                        type="button"
                        onClick={() => setActiveImgIdx(idx)}
                        className={`w-12 h-12 rounded-xl overflow-hidden border-2 shrink-0 cursor-pointer ${
                          idx === safeIdx ? 'border-[#43A4CF]' : 'border-transparent opacity-70 hover:opacity-100'
                        }`}
                      >
                        <img src={imgUrl} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-7xl select-none">🛍️</div>
            )}
          </div>

          {/* Информация о товаре справа */}
          <div className="md:col-span-7 p-6 sm:p-7 flex flex-col justify-between space-y-5">
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <h2 className="akn-font-rubik text-xl sm:text-2xl font-bold text-[#2E2F38] leading-snug">
                  {product.name}
                </h2>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center shrink-0 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Количество в наличии */}
              <div>
                {isAvailable ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-[#5ABF70] text-xs font-bold">
                    <span>●</span>
                    <span>В наличии: {stock} шт.</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 text-[#FF604E] text-xs font-bold">
                    <span>●</span>
                    <span>Количество: 0 шт.</span>
                  </span>
                )}
              </div>

              <p className="text-xs text-[#4B4E54] leading-relaxed bg-slate-50 p-3.5 rounded-2xl border border-slate-100 whitespace-pre-wrap">
                {product.description && product.description.trim()
                  ? product.description
                  : 'Оригинальная продукция интернет-магазина Aknyet. Доступен заказ с быстрой доставкой и самовывозом в Алматы.'}
              </p>
            </div>

            {/* Блок цены или «Нет в наличии» + добавление в корзину */}
            <div className="pt-4 border-t border-slate-100 space-y-4">
              {isAvailable ? (
                <>
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs text-slate-400">Цена:</span>
                    <strong className="akn-font-rubik text-2xl font-bold text-[#2E2F38]">
                      {Number(product.price).toLocaleString('ru-RU')}
                    </strong>
                    <span className="text-sm font-medium text-[#4B4E54]">тенге</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="akn-qty-control">
                      <button
                        type="button"
                        onClick={() => setQty((q) => Math.max(1, q - 1))}
                        className="akn-qty-btn"
                      >
                        −
                      </button>
                      <input type="text" readOnly value={qty} className="akn-qty-input" />
                      <button
                        type="button"
                        onClick={() => setQty((q) => Math.min(stock, q + 1))}
                        className="akn-qty-btn"
                      >
                        +
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        onAddToCart(product, qty);
                        onClose();
                      }}
                      className="akn-buy-btn flex-1 py-3"
                    >
                      🛒 В корзину ({(Number(product.price) * qty).toLocaleString('ru-RU')} ₸)
                    </button>
                  </div>
                </>
              ) : (
                <div className="py-3 px-4 rounded-2xl bg-red-50 border border-red-200 text-[#FF604E] akn-font-rubik font-bold text-base text-center">
                  Нет в наличии
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
