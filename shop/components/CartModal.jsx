import React, { useState } from 'react';
import { processCheckoutAndDatabaseUpdate } from '../services/shopApi';

/**
 * ============================================================================
 * КОРЗИНА И ОФОРМЛЕНИЕ ЗАКАЗА (shop/components/CartModal.jsx)
 * ============================================================================
 * Для клиентов отображаются только:
 * - Наименование товара
 * - Количество
 * - Цена
 * При нажатии на оплату происходит зависание и ошибка платежного шлюза,
 * а функция обновления БД (processCheckoutAndDatabaseUpdate) уже готова в коде.
 */
export default function CartModal({
  isOpen,
  onClose,
  cartItems = [],
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  onOrderSuccessRefreshDb,
}) {
  const [step, setStep] = useState('cart'); // 'cart' | 'checkout' | 'processing' | 'error' | 'success'
  const [customer, setCustomer] = useState({
    name: '',
    phone: '',
    deliveryType: 'pickup',
    address: '',
    comment: '',
  });

  const [paymentStage, setPaymentStage] = useState({
    step: 1,
    progress: 15,
    statusText: 'Подключение к платежному шлюзу...',
    subText: 'Пожалуйста, подождите',
    isHanging: false,
  });
  const [errorMessage, setErrorMessage] = useState('');
  const [orderResult, setOrderResult] = useState(null);

  if (!isOpen) return null;

  const totalItems = cartItems.reduce((sum, item) => sum + item.cartQuantity, 0);
  const totalAmount = cartItems.reduce(
    (sum, item) => sum + Number(item.price) * item.cartQuantity,
    0
  );

  // По умолчанию simulatePaymentError = true (имитирует зависание и ошибку оплаты).
  // Когда в будущем подключите эквайринг, достаточно передать simulatePaymentError = false,
  // и система автоматически спишет товары из БД.
  const handleStartPayment = async (e, simulatePaymentError = true) => {
    if (e) e.preventDefault();
    if (cartItems.length === 0) return;

    setStep('processing');
    setErrorMessage('');

    try {
      const result = await processCheckoutAndDatabaseUpdate(
        cartItems,
        customer,
        (stage) => setPaymentStage(stage),
        { simulatePaymentError }
      );

      setOrderResult(result);
      setStep('success');
      onClearCart();
      if (onOrderSuccessRefreshDb) {
        onOrderSuccessRefreshDb();
      }
    } catch (err) {
      setErrorMessage(
        err.message ||
          'Ошибка проведения платежа: превышено время ожидания ответа от платежного шлюза.'
      );
      setStep('error');
    }
  };

  const handleCloseModal = () => {
    if (step === 'processing') return;
    setStep('cart');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs flex items-center justify-end"
      onClick={handleCloseModal}
    >
      <div
        className="bg-white h-full w-full max-w-lg shadow-2xl flex flex-col justify-between overflow-hidden akn-animate-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ШАПКА КОРЗИНЫ */}
        <div className="p-5 sm:p-6 bg-[#2E2F38] text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-[#FFCD24] text-[#2E2F38] flex items-center justify-center text-xl font-bold">
              🛒
            </span>
            <div>
              <h2 className="akn-font-rubik text-lg font-bold leading-tight">
                {step === 'cart' && 'Ваша корзина'}
                {step === 'checkout' && 'Оформление заказа'}
                {step === 'processing' && 'Проведение оплаты...'}
                {step === 'error' && 'Ошибка оплаты'}
                {step === 'success' && 'Заказ оформлен'}
              </h2>
              <p className="text-xs text-white/70">
                {totalItems > 0
                  ? `${totalItems} шт. на сумму ${totalAmount.toLocaleString('ru-RU')} тенге`
                  : 'Корзина интернет-магазина Aknyet'}
              </p>
            </div>
          </div>

          {step !== 'processing' && (
            <button
              type="button"
              onClick={handleCloseModal}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>

        {/* ТЕЛО МОДАЛЬНОГО ОКНА */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6">
          {/* ЭКРАН 1: СПИСОК ТОВАРОВ В КОРЗИНЕ */}
          {step === 'cart' && (
            <>
              {cartItems.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center py-12 space-y-4">
                  <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center text-4xl">
                    🛍️
                  </div>
                  <div className="space-y-1">
                    <h3 className="akn-font-rubik text-lg font-bold text-[#2E2F38]">
                      Ваша корзина пока пуста
                    </h3>
                    <p className="text-xs text-slate-500 max-w-xs">
                      Выберите понравившиеся товары в каталоге или воспользуйтесь ИИ-помощником для подбора!
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="px-6 py-2.5 rounded-xl bg-[#43A4CF] text-white akn-font-rubik font-semibold text-sm cursor-pointer"
                  >
                    Перейти к покупкам
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-xs text-slate-500 pb-2 border-b border-slate-100">
                    <span>Выбранные товары ({cartItems.length})</span>
                    <button
                      type="button"
                      onClick={onClearCart}
                      className="text-[#FF604E] hover:underline font-medium cursor-pointer"
                    >
                      Очистить корзину
                    </button>
                  </div>

                  {cartItems.map((item) => {
                    const maxStock = Number(item.quantity) || 1;
                    return (
                      <div
                        key={item.id}
                        className="p-3.5 rounded-2xl border border-slate-200/80 bg-slate-50/60 flex flex-col gap-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h4 className="akn-font-rubik font-semibold text-sm text-[#2E2F38] leading-snug">
                              {item.name}
                            </h4>
                            <span className="text-[11px] text-slate-400">
                              В наличии: {maxStock} шт.
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => onRemoveItem(item.id)}
                            className="text-slate-400 hover:text-[#FF604E] text-sm px-1 cursor-pointer"
                            title="Удалить из корзины"
                          >
                            ✕
                          </button>
                        </div>

                        <div className="flex items-center justify-between pt-1">
                          <div className="akn-qty-control h-8">
                            <button
                              type="button"
                              onClick={() => onUpdateQuantity(item.id, item.cartQuantity - 1)}
                              className="akn-qty-btn text-sm"
                            >
                              −
                            </button>
                            <input
                              type="text"
                              readOnly
                              value={item.cartQuantity}
                              className="akn-qty-input text-xs w-8"
                            />
                            <button
                              type="button"
                              onClick={() => onUpdateQuantity(item.id, item.cartQuantity + 1)}
                              disabled={item.cartQuantity >= maxStock}
                              className="akn-qty-btn text-sm"
                              title={
                                item.cartQuantity >= maxStock
                                  ? 'Максимальное доступное количество'
                                  : 'Добавить еще 1 шт.'
                              }
                            >
                              +
                            </button>
                          </div>

                          <div className="text-right">
                            <div className="akn-font-rubik font-bold text-sm text-[#2E2F38]">
                              {(Number(item.price) * item.cartQuantity).toLocaleString('ru-RU')} тенге
                            </div>
                            {item.cartQuantity > 1 && (
                              <div className="text-[11px] text-slate-400">
                                {Number(item.price).toLocaleString('ru-RU')} ₸ × {item.cartQuantity} шт.
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* ЭКРАН 2: ВВОД ДАННЫХ ПОКУПАТЕЛЯ */}
          {step === 'checkout' && (
            <form id="checkout-form" onSubmit={(e) => handleStartPayment(e, true)} className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-sky-50 border border-sky-100 text-xs text-sky-900">
                Заполните контактные данные для оформления заказа. После подтверждения откроется окно онлайн-оплаты.
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                  Ваше имя *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Например: Алия"
                  value={customer.name}
                  onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:border-[#43A4CF] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                  Телефон (WhatsApp) *
                </label>
                <input
                  type="tel"
                  required
                  placeholder="+7 (701) 000-00-00"
                  value={customer.phone}
                  onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:border-[#43A4CF] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                  Способ получения
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setCustomer({ ...customer, deliveryType: 'pickup' })}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-semibold cursor-pointer ${
                      customer.deliveryType === 'pickup'
                        ? 'border-[#43A4CF] bg-sky-50 text-[#43A4CF]'
                        : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    🏬 Самовывоз (Алматы)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomer({ ...customer, deliveryType: 'delivery' })}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-semibold cursor-pointer ${
                      customer.deliveryType === 'delivery'
                        ? 'border-[#43A4CF] bg-sky-50 text-[#43A4CF]'
                        : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    🚚 Доставка курьером
                  </button>
                </div>
              </div>

              {customer.deliveryType === 'delivery' && (
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                    Адрес доставки
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="г. Алматы, ул. Абая, д. ..."
                    value={customer.address}
                    onChange={(e) => setCustomer({ ...customer, address: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:border-[#43A4CF] outline-none"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                  Комментарий к заказу
                </label>
                <textarea
                  rows={2}
                  placeholder="Пожелания по заказу..."
                  value={customer.comment}
                  onChange={(e) => setCustomer({ ...customer, comment: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:border-[#43A4CF] outline-none"
                />
              </div>
            </form>
          )}

          {/* ЭКРАН 3: ЗАВИСАНИЕ ПРИ ОПЛАТЕ */}
          {step === 'processing' && (
            <div className="py-12 px-4 flex flex-col items-center justify-center text-center space-y-6">
              <div className="relative w-20 h-20 flex items-center justify-center">
                <div
                  className={`w-20 h-20 rounded-full border-4 border-slate-200 border-t-[#43A4CF] ${
                    paymentStage.isHanging ? 'animate-pulse' : 'animate-spin'
                  }`}
                />
                <span className="absolute text-2xl">💳</span>
              </div>

              <div className="space-y-2 max-w-sm">
                <h3 className="akn-font-rubik text-lg font-bold text-[#2E2F38]">
                  {paymentStage.statusText}
                </h3>
                <p className="text-xs text-slate-500">{paymentStage.subText}</p>
              </div>

              <div className="w-full max-w-xs bg-slate-100 h-2.5 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-700 ${
                    paymentStage.isHanging ? 'bg-amber-400' : 'bg-[#43A4CF]'
                  }`}
                  style={{ width: `${paymentStage.progress}%` }}
                />
              </div>

              {paymentStage.isHanging && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs animate-pulse">
                  ⏳ Ожидание ответа от платежного шлюза... Пожалуйста, не закрывайте окно
                </div>
              )}
            </div>
          )}

          {/* ЭКРАН 4: ОШИБКА ОПЛАТЫ */}
          {step === 'error' && (
            <div className="py-8 space-y-5 akn-animate-in">
              <div className="p-6 rounded-2xl bg-red-50 border border-red-200 text-center space-y-3">
                <div className="w-14 h-14 mx-auto rounded-full bg-[#FF604E] text-white flex items-center justify-center text-2xl font-bold shadow-md">
                  ✕
                </div>
                <h3 className="akn-font-rubik text-lg font-bold text-red-900">
                  Не удалось провести оплату
                </h3>
                <p className="text-xs text-red-800 leading-relaxed">{errorMessage}</p>
                <div className="inline-block px-3 py-1 rounded-md bg-red-100 text-red-900 font-mono text-[11px]">
                  Код ошибки: ERR_PAYMENT_GATEWAY_TIMEOUT (504)
                </div>
              </div>
            </div>
          )}

          {/* ЭКРАН 5: УСПЕШНОЕ ОФОРМЛЕНИЕ ЗАКАЗА */}
          {step === 'success' && (
            <div className="py-8 text-center space-y-4 akn-animate-in">
              <div className="w-16 h-16 mx-auto rounded-full bg-[#5ABF70] text-white flex items-center justify-center text-3xl font-bold shadow-md">
                ✓
              </div>
              <h3 className="akn-font-rubik text-xl font-bold text-[#2E2F38]">
                Спасибо за ваш заказ!
              </h3>
              <p className="text-xs text-slate-600 max-w-sm mx-auto leading-relaxed">
                Заказ <strong>#{orderResult?.orderId}</strong> успешно принят в обработку. Мы свяжемся с вами в ближайшее время!
              </p>
              <button
                type="button"
                onClick={handleCloseModal}
                className="px-6 py-2.5 rounded-xl bg-[#43A4CF] text-white akn-font-rubik font-semibold text-sm cursor-pointer"
              >
                Вернуться в магазин
              </button>
            </div>
          )}
        </div>

        {/* ПОДВАЛ КОРЗИНЫ */}
        {cartItems.length > 0 && (step === 'cart' || step === 'checkout' || step === 'error') && (
          <div className="p-5 bg-slate-50 border-t border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600 font-medium">Итого к оплате:</span>
              <span className="akn-font-rubik text-xl font-bold text-[#2E2F38]">
                {totalAmount.toLocaleString('ru-RU')} тенге
              </span>
            </div>

            {step === 'cart' && (
              <button
                type="button"
                onClick={() => setStep('checkout')}
                className="w-full py-3.5 rounded-xl bg-[#FFCD24] hover:bg-[#f3bf10] text-[#2E2F38] akn-font-rubik font-bold text-sm shadow-sm transition-all cursor-pointer"
              >
                Перейти к оформлению заказа →
              </button>
            )}

            {step === 'checkout' && (
              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setStep('cart')}
                  className="px-4 py-3 rounded-xl bg-white border border-slate-300 text-slate-700 font-semibold text-xs cursor-pointer"
                >
                  ← Назад
                </button>
                <button
                  type="submit"
                  form="checkout-form"
                  className="flex-1 py-3 rounded-xl bg-[#43A4CF] hover:bg-[#338eb8] text-white akn-font-rubik font-bold text-sm shadow-md transition-all cursor-pointer"
                >
                  💳 Оплатить заказ ({totalAmount.toLocaleString('ru-RU')} ₸)
                </button>
              </div>
            )}

            {step === 'error' && (
              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setStep('cart')}
                  className="flex-1 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-700 font-semibold text-xs cursor-pointer"
                >
                  Вернуться в корзину
                </button>
                <button
                  type="button"
                  onClick={(e) => handleStartPayment(e, true)}
                  className="flex-1 py-2.5 rounded-xl bg-[#FFCD24] hover:bg-[#f3bf10] text-[#2E2F38] akn-font-rubik font-bold text-xs cursor-pointer"
                >
                  Повторить попытку оплаты
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
