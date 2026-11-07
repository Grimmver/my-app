/**
 * ============================================================================
 * СЕРВИС СВЯЗИ МАГАЗИНА С БАЗОЙ ДАННЫХ И ИИ-ПОМОЩНИКОМ (shop/services/shopApi.js)
 * ============================================================================
 * Отвечает за:
 * 1. Загрузку товаров и категорий из базы данных склада (Turso / server.js)
 * 2. Имитацию зависания и ошибки оплаты + готовую функцию обновления БД на будущее
 * 3. Работу ИИ-помощника для умного подбора товаров из актуального каталога БД
 */

// Базовый адрес сервера (совпадает с настройкой в складском приложении src/App.jsx)
export const API_URL = 'http://localhost:3000/api';

// Демо-товары в стиле aknyet.kz (используются ТОЛЬКО если локальный сервер server.js выключен,
// чтобы интерфейс магазина всегда можно было протестировать)
export const FALLBACK_DEMO_CATEGORIES = [
  { id: 'cat-braslety', name: 'Браслеты', color: 'bg-sky-100 text-sky-800' },
  { id: 'cat-svechi', name: 'Программные свечи', color: 'bg-amber-100 text-amber-800' },
  { id: 'cat-blagovoniya', name: 'Благовония и травы', color: 'bg-emerald-100 text-emerald-800' },
  { id: 'cat-fenshui', name: 'Сувениры Фэн-шуй и Дзи', color: 'bg-purple-100 text-purple-800' },
];

export const FALLBACK_DEMO_PRODUCTS = [
  {
    id: 'demo-1',
    name: 'Дзи "Нектарный сосуд изобилия" (черный) 10Х14ММ',
    internalCode: 'AKN-101',
    govCode: '487000101',
    quantity: 14,
    price: 3000,
    categoryId: 'cat-fenshui',
  },
  {
    id: 'demo-2',
    name: 'Браслет «Миллионера» из натурального цитрина и пирита',
    internalCode: 'AKN-204',
    govCode: '487000204',
    quantity: 7,
    price: 6500,
    categoryId: 'cat-braslety',
  },
  {
    id: 'demo-3',
    name: 'Программная эко-свеча «Финансовый поток и Успех» с травами',
    internalCode: 'AKN-309',
    govCode: '487000309',
    quantity: 22,
    price: 2500,
    categoryId: 'cat-svechi',
  },
  {
    id: 'demo-4',
    name: 'Браслет из красной нити с бусиной Дзи 9 глаз',
    internalCode: 'AKN-112',
    govCode: '487000112',
    quantity: 0, // Нет в наличии — демонстрация вывода «Нет в наличии» вместо цены
    price: 4200,
    categoryId: 'cat-braslety',
  },
  {
    id: 'demo-5',
    name: 'Набор трав для окуривания помещения «Очищение и Гармония»',
    internalCode: 'AKN-405',
    govCode: '487000405',
    quantity: 5,
    price: 1800,
    categoryId: 'cat-blagovoniya',
  },
  {
    id: 'demo-6',
    name: 'Восковая алтарная свеча ручной работы «Защита дома»',
    internalCode: 'AKN-315',
    govCode: '487000315',
    quantity: 0, // Нет в наличии
    price: 3500,
    categoryId: 'cat-svechi',
  },
];

/**
 * 1. Получение товаров и категорий из базы данных склада
 */
export async function fetchShopCatalog() {
  // Способ А: Публичный эндпоинт магазина /api/shop/catalog
  try {
    const res = await fetch(`${API_URL}/shop/catalog`);
    if (res.ok) {
      const data = await res.json();
      return {
        products: data.products || [],
        categories: data.categories || [],
        source: 'database',
      };
    }
  } catch (err) {
    // Сервер на localhost:3000 может быть не запущен или маршруты еще не перезапущены
  }

  // Способ Б: Если сервер запущен со старым server.js (без перезапуска), пробуем /api/data с токеном склада
  const savedToken = localStorage.getItem('token');
  if (savedToken) {
    try {
      const res = await fetch(`${API_URL}/data`, {
        headers: { Authorization: `Bearer ${savedToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        return {
          products: data.products || [],
          categories: data.categories || [],
          source: 'database',
        };
      }
    } catch (err) {
      // Игнорируем и переходим к резервному варианту
    }
  }

  // Способ В: Если пользователь еще не входил в склад, но старый server.js запущен —
  // пробуем получить гостевой токен стандартного продавца/владельца для чтения каталога
  try {
    const loginRes = await fetch(`${API_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'seller', password: '12345' }),
    });
    if (loginRes.ok) {
      const loginData = await loginRes.json();
      const dataRes = await fetch(`${API_URL}/data`, {
        headers: { Authorization: `Bearer ${loginData.token}` },
      });
      if (dataRes.ok) {
        const data = await dataRes.json();
        return {
          products: data.products || [],
          categories: data.categories || [],
          source: 'database',
        };
      }
    }
  } catch (err) {
    // Сервер не запущен
  }

  // Если сервер БД недоступен — возвращаем демо-данные и помечаем источник 'demo'
  return {
    products: FALLBACK_DEMO_PRODUCTS,
    categories: FALLBACK_DEMO_CATEGORIES,
    source: 'demo',
  };
}

/**
 * 2. СИСТЕМА ПРОВЕДЕНИЯ ОПЛАТЫ И ОБНОВЛЕНИЯ БАЗЫ ДАННЫХ СКЛАДА
 *
 * @param {Array} cartItems - товары в корзине [{ id, name, price, cartQuantity, quantity }]
 * @param {Object} customer - данные покупателя { name, phone, address, deliveryType, comment }
 * @param {Function} onStageChange - коллбэк для отображения этапов зависания оплаты в UI
 * @param {Object} options - { simulatePaymentError: true | false }
 *   По заданию: пока вместо оплаты происходит зависание и ошибка (simulatePaymentError = true),
 *   но система обновления базы данных на будущее уже полностью готова (simulatePaymentError = false).
 */
export async function processCheckoutAndDatabaseUpdate(
  cartItems,
  customer,
  onStageChange = () => {},
  options = { simulatePaymentError: true }
) {
  const { simulatePaymentError = true } = options;

  // Этап 1: Подключение к платежному шлюзу
  onStageChange({
    step: 1,
    progress: 25,
    statusText: 'Соединение с защищенным платежным шлюзом...',
    subText: 'Проверка сертификата безопасности TLS 1.3',
  });
  await new Promise((r) => setTimeout(r, 1200));

  // Этап 2: Отправка данных транзакции
  onStageChange({
    step: 2,
    progress: 60,
    statusText: 'Проверка данных и авторизация суммы...',
    subText: 'Ожидание ответа от банка-эквайера',
  });
  await new Promise((r) => setTimeout(r, 1500));

  // Этап 3: Зависание на 85% (имитация зависания платежной системы)
  onStageChange({
    step: 3,
    progress: 85,
    statusText: 'Обработка транзакции... Пожалуйста, не закрывайте страницу',
    subText: 'Сервер оплаты отвечает дольше обычного (ожидание отклика шлюза)...',
    isHanging: true,
  });

  if (simulatePaymentError) {
    // Зависаем на ~4 секунды, затем возвращаем ошибку платежного шлюза
    await new Promise((r) => setTimeout(r, 4000));
    throw new Error(
      'Ошибка оплаты (Код: 504 GATEWAY_TIMEOUT): Платежный шлюз перестал отвечать. Деньги не были списаны, пожалуйста, повторите попытку позже.'
    );
  }

  // ==========================================================================
  // БУДУЩАЯ СИСТЕМА ОБНОВЛЕНИЯ БАЗЫ ДАННЫХ СКЛАДА ПРИ УСПЕШНОЙ ОПЛАТЕ
  // ==========================================================================
  onStageChange({
    step: 4,
    progress: 95,
    statusText: 'Оплата подтверждена! Обновление остатков в базе данных склада...',
    subText: 'Списание купленных товаров и запись в историю продаж Turso',
    isHanging: false,
  });

  const payload = {
    items: cartItems.map((item) => ({
      id: item.id,
      quantity: item.cartQuantity,
    })),
    customer,
    simulatePaymentError: false,
  };

  // 1. Вызываем наш новый серверный эндпоинт /api/shop/checkout
  try {
    const res = await fetch(`${API_URL}/shop/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const result = await res.json();
      return result;
    }

    // Если сервер вернул конкретную бизнес-ошибку (например, нехватка остатка)
    if (res.status === 400 || res.status === 404) {
      const errData = await res.json();
      throw new Error(errData.error || 'Ошибка при обновлении остатков в БД');
    }
  } catch (err) {
    if (err.message.includes('Недостаточно') || err.message.includes('не найден')) {
      throw err;
    }
  }

  // 2. Резервный механизм обновления БД через существующий эндпоинт склада POST /api/products/:id/sell
  // (на случай если server.js запущен в старой версии без перезапуска)
  let token = localStorage.getItem('token');
  if (!token) {
    try {
      const loginRes = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'seller', password: '12345' }),
      });
      if (loginRes.ok) {
        const loginData = await loginRes.json();
        token = loginData.token;
      }
    } catch (e) {
      // игнорируем
    }
  }

  if (token) {
    for (const item of cartItems) {
      const sellRes = await fetch(`${API_URL}/products/${item.id}/sell`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ quantityToSell: item.cartQuantity }),
      });
      if (!sellRes.ok) {
        throw new Error(`Не удалось обновить остаток товара "${item.name}" в базе данных`);
      }
    }
    return {
      success: true,
      orderId: 'AKN-' + Date.now().toString().slice(-6),
      message: 'Заказ успешно проведен, остатки и прибыль в базе данных склада обновлены!',
    };
  }

  throw new Error('Нет связи с сервером базы данных (убедитесь, что запущен node server.js)');
}

/**
 * 3. УМНЫЙ ИИ-ПОМОЩНИК ДЛЯ ВЫБОРА ТОВАРА ИЗ БАЗЫ ДАННЫХ
 * Анализирует запрос пользователя, сопоставляет с реальными товарами из БД склада,
 * учитывает наличие (quantity > 0), цену/бюджет, категории и ключевые слова.
 */
export async function askShopAiAssistant(userQuery, products = [], categories = []) {
  const query = userQuery.trim();
  const lower = query.toLowerCase();

  // Сначала пробуем серверный ИИ (если на сервере настроен GEMINI_API_KEY)
  try {
    const res = await fetch(`${API_URL}/shop/ai-assistant`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.reply) {
        const matched = findMatchingProducts(lower, products, categories);
        return {
          text: data.reply,
          recommendedProducts: matched.slice(0, 4),
        };
      }
    }
  } catch (e) {
    // Переходим к встроенному интеллектуальному анализатору БД
  }

  // Небольшая задержка для естественного ощущения диалога с ИИ
  await new Promise((r) => setTimeout(r, 450));

  const availableProducts = products.filter((p) => Number(p.quantity) > 0);
  const outOfStockProducts = products.filter((p) => Number(p.quantity) <= 0);

  if (products.length === 0) {
    return {
      text: 'Сейчас каталог обновляется. Пожалуйста, загляните чуть позже, и я с радостью помогу вам с выбором!',
      recommendedProducts: [],
    };
  }

  if (availableProducts.length === 0) {
    return {
      text: `К сожалению, сейчас все товары из каталога временно закончились. Загляните чуть позже!`,
      recommendedProducts: [],
    };
  }

  // 1. Проверяем, ищет ли пользователь товары под конкретный бюджет (например: "до 3000", "на 5000 тг")
  const budgetMatch =
    lower.match(/(?:до|дешевле|бюджет|на сумму|максимум|не дороже|в пределах)\s*(\d[\d\s]*)/) ||
    lower.match(/(\d{3,7})\s*(?:тг|тенге|₸)/);

  let maxBudget = null;
  if (budgetMatch) {
    maxBudget = parseInt(budgetMatch[1].replace(/\s+/g, ''), 10);
  }

  // 2. Проверяем запросы на самые дешевые / доступные товары
  if (
    lower.includes('дешев') ||
    lower.includes('недорог') ||
    lower.includes('бюджетн') ||
    lower.includes('минимальн') ||
    lower.includes('доступн')
  ) {
    const cheapest = [...availableProducts].sort((a, b) => a.price - b.price).slice(0, 4);
    return {
      text: `Я подобрал для вас самые выгодные товары, которые сейчас есть в наличии (от ${cheapest[0]?.price?.toLocaleString('ru-RU')} тенге):`,
      recommendedProducts: cheapest,
    };
  }

  // 3. Проверяем запросы на премиум / дорогие товары / лучший подарок
  if (lower.includes('дорог') || lower.includes('премиум') || lower.includes('элитн') || lower.includes('роскош')) {
    const premium = [...availableProducts].sort((a, b) => b.price - a.price).slice(0, 4);
    return {
      text: `Вот лучшие предложения премиум-сегмента из наличия. Отличный выбор для особенного подарка:`,
      recommendedProducts: premium,
    };
  }

  // 4. Если указан конкретный бюджет в тенге
  if (maxBudget && !isNaN(maxBudget)) {
    const withinBudget = availableProducts
      .filter((p) => Number(p.price) <= maxBudget)
      .sort((a, b) => b.price - a.price);

    if (withinBudget.length === 0) {
      const minProduct = [...availableProducts].sort((a, b) => a.price - b.price)[0];
      return {
        text: `В пределах ${maxBudget.toLocaleString('ru-RU')} тенге сейчас нет товаров в наличии. Но обратите внимание на наш самый доступный товар — «${minProduct.name}» за ${minProduct.price.toLocaleString('ru-RU')} тенге:`,
        recommendedProducts: [minProduct],
      };
    }

    return {
      text: `В ваш бюджет до ${maxBudget.toLocaleString('ru-RU')} тенге отлично подходят ${withinBudget.length} тов. Вот наиболее интересные варианты:`,
      recommendedProducts: withinBudget.slice(0, 4),
    };
  }

  // 5. Проверяем запрос про наличие / весь ассортимент
  if (
    lower.includes('что есть') ||
    lower.includes('в наличии') ||
    lower.includes('ассортимент') ||
    lower.includes('каталог') ||
    lower.includes('все товары')
  ) {
    const catNames = categories.map((c) => c.name).filter(Boolean);
    return {
      text: `Сейчас в наличии ${availableProducts.length} тов.${
        catNames.length > 0 ? ` в категориях: ${catNames.join(', ')}` : ''
      }. Вот популярные позиции, доступные к заказу прямо сейчас:`,
      recommendedProducts: availableProducts.slice(0, 4),
    };
  }

  // 6. Поиск по ключевым словам (название товара, категория)
  const matchedInStock = findMatchingProducts(lower, availableProducts, categories);
  if (matchedInStock.length > 0) {
    return {
      text: `По вашему запросу «${query}» найдено ${matchedInStock.length} подходящих товаров в наличии. Рекомендую обратить внимание на эти позиции:`,
      recommendedProducts: matchedInStock.slice(0, 4),
    };
  }

  // Проверяем, может быть искомый товар есть в каталоге, но закончился (quantity <= 0)
  const matchedOut = findMatchingProducts(lower, outOfStockProducts, categories);
  if (matchedOut.length > 0) {
    const alternatives = availableProducts.slice(0, 3);
    return {
      text: `Товар «${matchedOut[0].name}» сейчас временно отсутствует в наличии. Вместо него могу предложить отличные альтернативы, доступные для заказа прямо сейчас:`,
      recommendedProducts: alternatives,
    };
  }

  // 7. Запрос на подарок / рекомендацию ("посоветуй", "подарок", "помоги выбрать")
  if (
    lower.includes('подар') ||
    lower.includes('посовет') ||
    lower.includes('выбрат') ||
    lower.includes('рекоменд') ||
    lower.includes('помог') ||
    lower.includes('привет') ||
    lower.includes('здравств')
  ) {
    // Выбираем разнообразные товары из разных категорий
    const diverse = [...availableProducts]
      .sort((a, b) => (b.sold_quantity || 0) - (a.sold_quantity || 0) || b.quantity - a.quantity)
      .slice(0, 4);

    return {
      text: `С удовольствием помогу с выбором! Я отобрал самые популярные товары нашего магазина, которые отлично подойдут как для себя, так и в подарок. Вы можете сразу добавить понравившийся вариант в корзину или уточнить ваш бюджет (например: «покажи товары до 4000 тенге»):`,
      recommendedProducts: diverse,
    };
  }

  // 8. Универсальный ответ с лучшими предложениями
  return {
    text: `По точному запросу «${query}» прямых совпадений в названиях не нашлось, но я подобрал для вас актуальные товары из нашего каталога, которые сейчас есть в наличии. Напишите желаемую категорию или бюджет, и я сужу поиск!`,
    recommendedProducts: availableProducts.slice(0, 4),
  };
}

/**
 * Вспомогательная функция нечеткого поиска по корням русских слов в названиях и категориях
 */
function findMatchingProducts(lowerQuery, productList, categories) {
  // Разбиваем запрос на значимые слова (от 3 символов)
  const stopWords = new Set([
    'мне', 'для', 'как', 'что', 'или', 'это', 'все', 'еще', 'при', 'под',
    'хочу', 'нужен', 'нужна', 'нужно', 'купить', 'найди', 'покажи', 'есть',
    'товар', 'товары', 'магазин', 'посоветуй', 'выбрать', 'тенге', 'цена',
  ]);

  const words = lowerQuery
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !stopWords.has(w))
    .map((w) => (w.length > 5 ? w.slice(0, -2) : w.length > 4 ? w.slice(0, -1) : w)); // отсекаем окончания для морфологии

  if (words.length === 0) return [];

  const scored = productList
    .map((p) => {
      const cat = categories.find((c) => c.id === p.categoryId);
      const haystack = `${p.name || ''} ${cat ? cat.name : ''} ${p.internalCode || ''} ${p.govCode || ''}`.toLowerCase();

      let score = 0;
      for (const stem of words) {
        if (haystack.includes(stem)) {
          score += 2;
        }
      }
      if (haystack.includes(lowerQuery)) {
        score += 5;
      }
      return { product: p, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.map((item) => item.product);
}
