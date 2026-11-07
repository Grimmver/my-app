import React from 'react';

/**
 * ============================================================================
 * ПОДВАЛ САЙТА В СТИЛЕ AKNYET.KZ (shop/components/ShopFooter.jsx)
 * ============================================================================
 */
export default function ShopFooter({
  categories = [],
  onSelectCategory,
  onOpenAiAssistant,
  onOpenCart,
}) {
  return (
    <footer className="mt-16 bg-[#2E2F38] text-white pt-12 pb-8 border-t border-slate-800">
      <div className="akn-container">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 pb-10 border-b border-white/10">
          {/* Колонка 1: О бренде Aknyet */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#43A4CF] flex items-center justify-center text-white akn-font-rubik font-bold text-xl">
                A
              </div>
              <span className="akn-font-rubik font-bold text-xl tracking-wide">Aknyet</span>
            </div>
            <p className="text-xs text-white/70 leading-relaxed">
              Продажа браслетов, программных свечей, феншуй товаров, сувениров и других товаров народного потребления в Алматы.
            </p>
          </div>

          {/* Колонка 2: Категории */}
          <div className="space-y-3">
            <h4 className="akn-font-rubik font-bold text-sm uppercase tracking-wider text-white/90">
              Каталог товаров
            </h4>
            <ul className="space-y-2 text-xs text-white/75">
              <li>
                <button
                  type="button"
                  onClick={() => onSelectCategory('all')}
                  className="hover:text-[#FFCD24] transition-colors cursor-pointer"
                >
                  Все товары магазина
                </button>
              </li>
              {categories.slice(0, 6).map((cat) => (
                <li key={cat.id}>
                  <button
                    type="button"
                    onClick={() => onSelectCategory(cat.id)}
                    className="hover:text-[#FFCD24] transition-colors cursor-pointer"
                  >
                    {cat.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Колонка 3: Покупателям */}
          <div className="space-y-3">
            <h4 className="akn-font-rubik font-bold text-sm uppercase tracking-wider text-white/90">
              Сервис для покупателей
            </h4>
            <ul className="space-y-2 text-xs text-white/75">
              <li>
                <button
                  type="button"
                  onClick={onOpenAiAssistant}
                  className="hover:text-[#FFCD24] transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <span>🤖</span>
                  <span>ИИ-помощник для подбора товара</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={onOpenCart}
                  className="hover:text-[#FFCD24] transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <span>🛒</span>
                  <span>Моя корзина и оформление заказа</span>
                </button>
              </li>
            </ul>
          </div>

          {/* Колонка 4: Контакты */}
          <div className="space-y-3">
            <h4 className="akn-font-rubik font-bold text-sm uppercase tracking-wider text-white/90">
              Наши контакты
            </h4>
            <div className="space-y-2 text-xs text-white/75">
              <p>📍 г. Алматы, Республика Казахстан</p>
              <p>
                📞{' '}
                <a href="tel:+77017972736" className="text-white font-semibold hover:text-[#FFCD24]">
                  +7 (701) 797-27-36
                </a>
              </p>
              <p>
                💬{' '}
                <a
                  href="https://wa.me/77017972736"
                  target="_blank"
                  rel="noreferrer"
                  className="text-emerald-400 hover:underline"
                >
                  Написать в WhatsApp
                </a>
              </p>
            </div>
          </div>
        </div>

        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-white/50">
          <div>© {new Date().getFullYear()} Интернет-магазин Aknyet. Все права защищены.</div>
          <div>г. Алматы, Казахстан</div>
        </div>
      </div>
    </footer>
  );
}
