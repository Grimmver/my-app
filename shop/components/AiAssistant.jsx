import React, { useState, useRef, useEffect } from 'react';
import { askShopAiAssistant } from '../services/shopApi';

/**
 * ============================================================================
 * ИИ-ПОМОЩНИК ДЛЯ ВЫБОРА ТОВАРА (shop/components/AiAssistant.jsx)
 * ============================================================================
 */
export default function AiAssistant({
  isOpen,
  onOpen,
  onClose,
  products = [],
  categories = [],
  onAddToCart,
  onQuickView,
}) {
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Здравствуйте! Я онлайн-помощник магазина Aknyet. Напишите, что вы ищете или на какую сумму рассчитываете, и я с радостью подберу для вас подходящие товары!',
      recommendedProducts: [],
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const chatEndRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, isTyping]);

  const handleSendMessage = async (customText = null) => {
    const textToSend = (customText ?? inputValue).trim();
    if (!textToSend || isTyping) return;

    const userMsg = {
      id: 'user-' + Date.now(),
      role: 'user',
      text: textToSend,
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!customText) setInputValue('');
    setIsTyping(true);

    try {
      const response = await askShopAiAssistant(textToSend, products, categories);
      setMessages((prev) => [
        ...prev,
        {
          id: 'ai-' + Date.now(),
          role: 'assistant',
          text: response.text,
          recommendedProducts: response.recommendedProducts || [],
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: 'ai-err-' + Date.now(),
          role: 'assistant',
          text: 'Произошла небольшая заминка при поиске. Попробуйте уточнить ваш запрос!',
          recommendedProducts: [],
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const quickPrompts = [
    'Что сейчас есть в наличии?',
    'Посоветуй подарок',
    'Самые недорогие товары',
    'Товары до 4000 тенге',
    ...categories.slice(0, 2).map((c) => `Покажи категорию ${c.name}`),
  ];

  return (
    <>
      {!isOpen && (
        <button
          type="button"
          onClick={onOpen}
          className="fixed bottom-6 right-6 z-40 px-5 py-3.5 rounded-full bg-gradient-to-r from-[#43A4CF] to-[#2b7da3] hover:from-[#338eb8] hover:to-[#226888] text-white akn-font-rubik font-semibold text-sm flex items-center gap-2.5 shadow-xl hover:scale-105 transition-all cursor-pointer"
        >
          <span className="w-7 h-7 rounded-full bg-[#FFCD24] text-[#2E2F38] flex items-center justify-center text-base">
            🤖
          </span>
          <span>ИИ-помощник выбора</span>
        </button>
      )}

      {isOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/45 backdrop-blur-xs flex items-end sm:items-center justify-center sm:justify-end p-0 sm:p-6"
          onClick={onClose}
        >
          <div
            className="bg-white w-full sm:max-w-md h-[88vh] sm:h-[640px] sm:rounded-[25px] rounded-t-[25px] shadow-2xl flex flex-col overflow-hidden border border-slate-100 akn-animate-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Шапка ИИ-помощника */}
            <div className="p-4 sm:p-5 bg-gradient-to-r from-[#43A4CF] to-[#2b7da3] text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#FFCD24] text-[#2E2F38] flex items-center justify-center text-xl font-bold shadow-xs">
                  🤖
                </div>
                <div>
                  <h3 className="akn-font-rubik font-bold text-base leading-tight">
                    ИИ-Консультант Aknyet
                  </h3>
                  <div className="text-[11px] text-white/85 flex items-center gap-1.5 mt-0.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />
                    <span>Онлайн-помощник по выбору товаров</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Быстрые подсказки */}
            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center gap-2 overflow-x-auto no-scrollbar">
              {quickPrompts.map((prompt, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSendMessage(prompt)}
                  className="px-3 py-1 rounded-full bg-white border border-slate-200 hover:border-[#43A4CF] text-xs text-[#2E2F38] hover:text-[#43A4CF] font-medium shrink-0 transition-colors cursor-pointer"
                >
                  {prompt}
                </button>
              ))}
            </div>

            {/* История сообщений */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#F9F9FA]">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${
                    msg.role === 'user' ? 'items-end' : 'items-start'
                  }`}
                >
                  <div
                    className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-[#43A4CF] text-white rounded-br-xs shadow-xs'
                        : 'bg-white text-[#2E2F38] border border-slate-200/80 rounded-bl-xs shadow-2xs'
                    }`}
                  >
                    {msg.text}
                  </div>

                  {/* Рекомендованные товары (наименование, количество, цена) */}
                  {msg.recommendedProducts && msg.recommendedProducts.length > 0 && (
                    <div className="mt-2.5 w-full max-w-[92%] space-y-2">
                      {msg.recommendedProducts.map((prod) => {
                        const stock = Number(prod.quantity) || 0;
                        const inStock = stock > 0;
                        return (
                          <div
                            key={prod.id}
                            className="p-3 rounded-xl bg-white border border-slate-200 shadow-2xs flex items-center justify-between gap-3 hover:border-[#43A4CF] transition-colors"
                          >
                            <div
                              onClick={() => onQuickView && onQuickView(prod)}
                              className="min-w-0 flex-1 cursor-pointer"
                            >
                              <div className="akn-font-rubik font-semibold text-xs text-[#2E2F38] hover:text-[#43A4CF] truncate">
                                {prod.name}
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                {inStock ? (
                                  <>
                                    <span className="akn-font-rubik font-bold text-xs text-[#43A4CF]">
                                      {Number(prod.price).toLocaleString('ru-RU')} тенге
                                    </span>
                                    <span className="text-[10px] text-[#5ABF70] font-medium">
                                      • В наличии: {stock} шт.
                                    </span>
                                  </>
                                ) : (
                                  <span className="text-[11px] font-bold text-[#FF604E]">
                                    Нет в наличии
                                  </span>
                                )}
                              </div>
                            </div>

                            {inStock && (
                              <button
                                type="button"
                                onClick={() => onAddToCart(prod, 1)}
                                className="px-3 py-1.5 rounded-lg bg-[#FFCD24] hover:bg-[#f3bf10] text-[#2E2F38] akn-font-rubik font-bold text-xs shrink-0 cursor-pointer"
                              >
                                + В корзину
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}

              {isTyping && (
                <div className="flex items-center gap-2 text-xs text-slate-400 px-2">
                  <span className="animate-bounce">●</span>
                  <span className="animate-bounce" style={{ animationDelay: '0.15s' }}>●</span>
                  <span className="animate-bounce" style={{ animationDelay: '0.3s' }}>●</span>
                  <span>Помощник подбирает товары...</span>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="p-3 bg-white border-t border-slate-200 flex items-center gap-2"
            >
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Напишите, какой товар вы ищете..."
                className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-100 focus:bg-white border border-transparent focus:border-[#43A4CF] text-sm outline-none transition-all"
              />
              <button
                type="submit"
                disabled={!inputValue.trim() || isTyping}
                className="px-4 py-2.5 rounded-xl bg-[#43A4CF] hover:bg-[#338eb8] disabled:opacity-40 text-white akn-font-rubik font-semibold text-sm transition-colors cursor-pointer"
              >
                Отправить
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
