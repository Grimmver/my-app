/**
 * ============================================================================
 * СЕРВЕРНЫЙ МОДУЛЬ ИНТЕРНЕТ-МАГАЗИНА (shop/shopBackend.js)
 * ============================================================================
 * Этот файл отвечает за связь витрины интернет-магазина с облачной базой данных
 * склада (Turso / libSQL), определенной в server.js.
 *
 * Что здесь реализовано:
 * 1. GET  /api/shop/catalog      — Публичное получение товаров и категорий со склада
 * 2. POST /api/shop/checkout     — Оформление заказа + СИСТЕМА ОБНОВЛЕНИЯ БАЗЫ ДАННЫХ
 *                                  (вычитание остатков, расчет прибыли, запись в историю)
 * 3. POST /api/shop/ai-assistant — Серверный ИИ-помощник для подбора товаров по базе
 */

export function setupShopRoutes(app, db) {
  // --------------------------------------------------------------------------
  // 1. ПОЛУЧЕНИЕ КАТАЛОГА ТОВАРОВ И КАТЕГОРИЙ ДЛЯ ВИТРИНЫ МАГАЗИНА
  // --------------------------------------------------------------------------
  app.get('/api/shop/catalog', async (req, res) => {
    try {
      // Загружаем товары (без раскрытия закупочной себестоимости cost для обычных покупателей)
      const productsResult = await db.execute('SELECT * FROM products');
      const categoriesResult = await db.execute('SELECT * FROM categories');

      res.json({
        products: productsResult.rows.map((row) => ({
          id: String(row.id),
          name: row.name || 'Без названия',
          internalCode: row.internalCode || '',
          govCode: row.govCode || '',
          quantity: Number(row.quantity) || 0,
          price: Number(row.price) || 0,
          categoryId: row.categoryId || '',
          sold_quantity: Number(row.sold_quantity) || 0,
          description: row.description || '',
          images: row.images || '[]',
        })),
        categories: categoriesResult.rows.map((cat) => ({
          id: String(cat.id),
          name: cat.name || 'Категория',
          color: cat.color || '',
        })),
      });
    } catch (err) {
      console.error('Ошибка при загрузке каталога магазина:', err);
      res.status(500).json({ error: 'Не удалось загрузить каталог товаров из базы данных' });
    }
  });

  // --------------------------------------------------------------------------
  // 2. СИСТЕМА ОФОРМЛЕНИЯ ЗАКАЗА И ОБНОВЛЕНИЯ БАЗЫ ДАННЫХ СКЛАДА НА БУДУЩЕЕ
  // --------------------------------------------------------------------------
  /**
   * Как работает этот эндпоинт:
   * - По умолчанию сейчас при оплате включен режим имитации зависания и ошибки
   *   платежного шлюза (`simulatePaymentError = true`), как указано в ТЗ.
   * - Но вся логика обновления базы данных Turso (проверка остатков, списание
   *   купленного количества, увеличение счетчика продаж `sold_quantity`,
   *   расчет фактической прибыли `realized_profit` и запись в таблицу `history`)
   *   УЖЕ ПОЛНОСТЬЮ РЕАЛИЗОВАНА ниже.
   * - Когда в будущем будет подключен реальный эквайринг (Kaspi / Halyk / CloudPayments),
   *   достаточно передавать `simulatePaymentError: false`, и база данных склада
   *   будет автоматически обновляться при каждой покупке!
   */
  app.post('/api/shop/checkout', async (req, res) => {
    const {
      items = [],
      customer = {},
      simulatePaymentError = true, // По умолчанию имитируем зависание и ошибку оплаты
    } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Корзина пуста' });
    }

    // --- РЕЖИМ 1: Имитация зависания платежного шлюза и ошибки оплаты ---
    if (simulatePaymentError) {
      // Искусственная задержка на стороне сервера (зависание перед ошибкой)
      await new Promise((resolve) => setTimeout(resolve, 4500));
      return res.status(504).json({
        success: false,
        code: 'ERR_PAYMENT_GATEWAY_TIMEOUT',
        error:
          'Ошибка оплаты: Превышено время ожидания ответа от платежного шлюза (504 Gateway Timeout). Средства не списаны.',
      });
    }

    // --- РЕЖИМ 2: Полное обновление базы данных склада (для будущей оплаты) ---
    try {
      // Шаг 1. Проверяем актуальные остатки всех товаров в корзине
      const validatedItems = [];

      for (const cartItem of items) {
        const qtyToBuy = Number(cartItem.quantity) || 0;
        if (qtyToBuy <= 0) continue;

        const productRes = await db.execute({
          sql: 'SELECT * FROM products WHERE id = ?',
          args: [cartItem.id],
        });

        if (productRes.rows.length === 0) {
          return res.status(404).json({
            error: `Товар с ID "${cartItem.id}" не найден в базе склада`,
          });
        }

        const dbProduct = productRes.rows[0];
        const currentQty = Number(dbProduct.quantity) || 0;

        if (currentQty < qtyToBuy) {
          return res.status(400).json({
            error: `Недостаточно товара "${dbProduct.name}" на складе. Доступно: ${currentQty} шт., в корзине: ${qtyToBuy} шт.`,
            productId: dbProduct.id,
            availableQuantity: currentQty,
          });
        }

        validatedItems.push({
          dbProduct,
          qtyToBuy,
        });
      }

      // Шаг 2. Формируем пакет SQL-запросов (batch) для атомарного обновления БД
      const statements = [];
      const customerLabel = customer?.name
        ? `Магазин (${customer.name}${customer.phone ? ', ' + customer.phone : ''})`
        : 'Интернет-магазин Aknyet';

      for (const { dbProduct, qtyToBuy } of validatedItems) {
        const currentQty = Number(dbProduct.quantity) || 0;
        const price = Number(dbProduct.price) || 0;
        const cost = Number(dbProduct.cost) || 0;
        const currentSold = Number(dbProduct.sold_quantity) || 0;
        const currentProfit = Number(dbProduct.realized_profit) || 0;

        const newQty = currentQty - qtyToBuy;
        const newSold = currentSold + qtyToBuy;
        const profitFromSale = qtyToBuy * (price - cost);
        const newTotalProfit = currentProfit + profitFromSale;

        // Обновляем остаток, количество проданных единиц и фактическую прибыль
        statements.push({
          sql: `UPDATE products SET quantity = ?, sold_quantity = ?, realized_profit = ? WHERE id = ?`,
          args: [newQty, newSold, newTotalProfit, dbProduct.id],
        });

        // Записываем операцию в историю изменений склада
        statements.push({
          sql: `INSERT INTO history (product_id, product_name, field, old_value, new_value, user_name) VALUES (?, ?, ?, ?, ?, ?)`,
          args: [
            dbProduct.id,
            dbProduct.name,
            'Продажа (Сайт)',
            `Остаток: ${currentQty}`,
            `Куплено: ${qtyToBuy} шт. (Остаток: ${newQty})`,
            customerLabel,
          ],
        });
      }

      if (statements.length > 0) {
        await db.batch(statements);
      }

      const orderId = 'AKN-' + Date.now().toString().slice(-6);

      res.json({
        success: true,
        orderId,
        message: 'Заказ успешно оформлен, остатки на складе обновлены!',
        updatedCount: validatedItems.length,
      });
    } catch (err) {
      console.error('Ошибка при обновлении БД во время оформления заказа:', err);
      res.status(500).json({
        error: 'Внутренняя ошибка сервера при обновлении складской базы данных: ' + err.message,
      });
    }
  });

  // --------------------------------------------------------------------------
  // 3. ИИ-ПОМОЩНИК ДЛЯ ВЫБОРА ТОВАРА (СЕРВЕРНЫЙ ЭНДПОИНТ)
  // --------------------------------------------------------------------------
  app.post('/api/shop/ai-assistant', async (req, res) => {
    const { query = '' } = req.body;

    try {
      const productsResult = await db.execute(
        'SELECT id, name, internalCode, govCode, quantity, price, categoryId FROM products'
      );
      const categoriesResult = await db.execute('SELECT id, name FROM categories');

      const products = productsResult.rows.map((p) => ({
        id: String(p.id),
        name: String(p.name || ''),
        internalCode: String(p.internalCode || ''),
        govCode: String(p.govCode || ''),
        quantity: Number(p.quantity) || 0,
        price: Number(p.price) || 0,
        categoryId: String(p.categoryId || ''),
      }));

      const categories = categoriesResult.rows.map((c) => ({
        id: String(c.id),
        name: String(c.name || ''),
      }));

      // Если задан ключ GEMINI_API_KEY в переменных окружения, используем Gemini API
      const apiKey = process.env.GEMINI_API_KEY || '';
      if (apiKey) {
        try {
          const availableList = products
            .filter((p) => p.quantity > 0)
            .map((p) => {
              const cat = categories.find((c) => c.id === p.categoryId);
              return `[ID:${p.id}] "${p.name}" — ${p.price} тг (Категория: ${cat ? cat.name : 'Общая'}, В наличии: ${p.quantity} шт.)`;
            })
            .join('\n');

          const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
          const promptText = `Ты вежливый ИИ-консультант интернет-магазина Aknyet. Помоги покупателю выбрать товар ТОЛЬКО из списка доступных товаров в базе данных.
Список товаров в наличии:
${availableList || 'Сейчас нет товаров в наличии'}

Запрос покупателя: "${query}"
Ответь дружелюбно на русском языке (2-4 предложения), посоветуй конкретные товары из списка с указанием их цены в тенге.`;

          const aiRes = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: promptText }] }],
            }),
          });
          const aiData = await aiRes.json();
          const text = aiData.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            return res.json({ reply: text });
          }
        } catch (aiErr) {
          console.warn('Gemini API недоступен, используем локальный ИИ-алгоритм подбора:', aiErr.message);
        }
      }

      // Если ключа нет, возвращаем флаг для работы клиентского умного алгоритма
      res.json({ reply: null, fallbackToLocalAi: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
}
