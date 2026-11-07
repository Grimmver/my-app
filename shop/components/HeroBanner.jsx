import React, { useState, useEffect } from 'react';

/**
 * ============================================================================
 * ГЛАВНЫЙ СЛАЙДЕР-БАННЕР И БЛОК КАТЕГОРИЙ (shop/components/HeroBanner.jsx)
 * ============================================================================
 * Воссоздает верхний блок .site-top-slider и .site-folders-in-block_2 с сайта aknyet.kz
 */
const SLIDES = [
  {
    id: 1,
    title: 'Освежи свой стиль, освещай свой путь',
    subtitle: 'Закажите оригинальные товары в нашем интернет-магазине в Алматы',
    badge: 'Коллекция Aknyet',
    bgImage: 'https://aknyet.kz/thumb/2/Oc-buGXKf28blNZFXwnzGg/1920c/d/banet.jpg',
    fallbackGradient: 'linear-gradient(135deg, #2b6785 0%, #43A4CF 55%, #8ecae6 100%)',
  },
  {
    id: 2,
    title: 'Талисманы, свечи, сувениры и товары на каждый день',
    subtitle: 'Широкий выбор изделий для гармонии, уюта и вдохновения',
    badge: 'Новинки и хиты',
    bgImage: 'https://aknyet.kz/thumb/2/yHiD98eTw-5dy6cvMNY3zQ/1920c/d/bane.jpg',
    fallbackGradient: 'linear-gradient(135deg, #2E2F38 0%, #3d5a80 55%, #43A4CF 100%)',
  },
];

export default function HeroBanner({
  categories = [],
  products = [],
  selectedCategory,
  onSelectCategory,
  onOpenAiAssistant,
  onScrollToCatalog,
}) {
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % SLIDES.length);
    }, 6500);
    return () => clearInterval(timer);
  }, []);

  const slide = SLIDES[currentSlide];

  return (
    <section className="pt-6 pb-4 space-y-6">
      <div className="akn-container">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Левый основной слайдер */}
          <div
            className="lg:col-span-8 xl:col-span-9 akn-hero-banner flex items-center p-6 sm:p-10 md:p-12 transition-all duration-500"
            style={{
              backgroundImage: `url("${slide.bgImage}"), ${slide.fallbackGradient}`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          >
            <div className="akn-hero-glass relative z-10 space-y-4">
              <span className="inline-block px-3 py-1 rounded-full bg-[#43A4CF] text-white text-xs font-bold uppercase tracking-wider">
                {slide.badge}
              </span>
              <h1 className="akn-font-rubik text-2xl sm:text-3xl md:text-4xl font-bold text-[#2E2F38] leading-tight">
                {slide.title}
              </h1>
              <p className="text-sm sm:text-base text-[#4B4E54] font-normal">{slide.subtitle}</p>
              <div className="pt-2 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={onScrollToCatalog}
                  className="px-6 py-3 rounded-xl bg-[#43A4CF] hover:bg-[#338eb8] text-white akn-font-rubik font-semibold text-sm flex items-center gap-2 shadow-md transition-all cursor-pointer"
                >
                  <span>Перейти в каталог</span>
                  <span>→</span>
                </button>
                <button
                  type="button"
                  onClick={onOpenAiAssistant}
                  className="px-5 py-3 rounded-xl bg-[#FFCD24] hover:bg-[#f3bf10] text-[#2E2F38] akn-font-rubik font-semibold text-sm flex items-center gap-2 shadow-sm transition-all cursor-pointer"
                >
                  <span>🤖</span>
                  <span>Помощник выбора</span>
                </button>
              </div>
            </div>

            <div className="absolute bottom-4 right-5 z-10 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentSlide((prev) => (prev - 1 + SLIDES.length) % SLIDES.length)}
                className="w-10 h-10 rounded-xl bg-white/80 hover:bg-white text-[#2E2F38] flex items-center justify-center shadow-sm transition-all cursor-pointer font-bold"
                title="Предыдущий слайд"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={() => setCurrentSlide((prev) => (prev + 1) % SLIDES.length)}
                className="w-10 h-10 rounded-xl bg-white/80 hover:bg-white text-[#2E2F38] flex items-center justify-center shadow-sm transition-all cursor-pointer font-bold"
                title="Следующий слайд"
              >
                ›
              </button>
            </div>
          </div>

          {/* Правый промо-блок ИИ-консультанта */}
          <div className="lg:col-span-4 xl:col-span-3 rounded-[25px] bg-gradient-to-b from-[#2E2F38] to-[#1e2028] text-white p-7 flex flex-col justify-between shadow-lg relative overflow-hidden">
            <div className="space-y-3 relative z-10">
              <div className="w-12 h-12 rounded-2xl bg-[#FFCD24] text-[#2E2F38] flex items-center justify-center text-2xl font-bold shadow-md">
                ✨
              </div>
              <h2 className="akn-font-rubik text-xl font-bold leading-snug">
                Не знаете, что выбрать?
              </h2>
              <p className="text-xs text-white/75 leading-relaxed">
                Наш ИИ-помощник учтет ваши пожелания и бюджет и моментально подберет лучшие товары из каталога!
              </p>
            </div>

            <div className="pt-5 relative z-10 space-y-2.5">
              <div className="text-[11px] text-amber-300/90 font-medium flex items-center gap-1.5">
                <span>●</span>
                <span>Доступно к заказу: {products.filter((p) => Number(p.quantity) > 0).length} тов.</span>
              </div>
              <button
                type="button"
                onClick={onOpenAiAssistant}
                className="w-full py-3 px-4 rounded-xl bg-[#FFCD24] hover:bg-[#f3bf10] text-[#2E2F38] akn-font-rubik font-bold text-sm transition-all cursor-pointer shadow-md"
              >
                Спросить ИИ-помощника
              </button>
            </div>
          </div>
        </div>

        {/* Блок категорий с количеством товаров */}
        <div className="mt-6">
          <div className="flex items-center gap-2.5 overflow-x-auto pb-2 no-scrollbar">
            <button
              type="button"
              onClick={() => onSelectCategory('all')}
              className={`akn-folder-pill shrink-0 ${selectedCategory === 'all' ? 'active' : ''}`}
            >
              <span>Все товары</span>
              <span className="akn-folder-count">{products.length}</span>
            </button>

            {categories.map((cat) => {
              const count = products.filter((p) => p.categoryId === cat.id).length;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => onSelectCategory(cat.id)}
                  className={`akn-folder-pill shrink-0 ${selectedCategory === cat.id ? 'active' : ''}`}
                >
                  <span>{cat.name}</span>
                  <span className="akn-folder-count">{count}</span>
                </button>
              );
            })}

            {products.some((p) => !p.categoryId) && (
              <button
                type="button"
                onClick={() => onSelectCategory('none')}
                className={`akn-folder-pill shrink-0 ${selectedCategory === 'none' ? 'active' : ''}`}
              >
                <span>Разное</span>
                <span className="akn-folder-count">
                  {products.filter((p) => !p.categoryId).length}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
