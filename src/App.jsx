import React, { useState, useEffect } from 'react';

// Если вы запускаете локально, оставьте http://localhost:3000
// При деплое на Render, замените на URL вашего веб-сервиса, например: https://my-sklad.onrender.com
const API_URL = "https://my-app-0m5k.onrender.com/api"; 

export default function App() {
  // --- Состояния авторизации ---
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return sessionStorage.getItem('app_authenticated') === 'true';
  });
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState('');

  // --- Основные данные склада ---
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);

  // --- Фильтры, поиск и сортировка ---
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');

  // --- Модальные окна и уведомления ---
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [isManageCategoriesOpen, setIsManageCategoriesOpen] = useState(false);
  const [notification, setNotification] = useState(null);

  // --- Состояния AI Аналитика ---
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState('');

  // --- Формы создания ---
  const [newProduct, setNewProduct] = useState({
    name: '',
    internalCode: '',
    govCode: '',
    quantity: 0,
    price: 0,
    cost: 0,
    categoryId: ''
  });
  const [newCategoryName, setNewCategoryName] = useState('');

  // --- Быстрое инлайн-редактирование ---
  const [inlineEditState, setInlineEditState] = useState({
    productId: null,
    field: null, // 'quantity' | 'price' | 'cost' | 'categoryId'
    value: ''
  });

  const currentPassword = sessionStorage.getItem('app_password') || '';

  // Загружаем данные из общей базы сразу после успешного входа
  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
    }
  }, [isAuthenticated]);

  // Функция всплывающих уведомлений
  const showToast = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // Метод получения всех данных с сервера
  const fetchData = async () => {
    try {
      const res = await fetch(`${API_URL}/data`, {
        headers: { 'Authorization': currentPassword }
      });
      if (res.ok) {
        const data = await res.json();
        setProducts(data.products || []);
        setCategories(data.categories || []);
      } else if (res.status === 401) {
        handleLogout();
      }
    } catch (err) {
      showToast('Ошибка подключения к серверу базы данных', 'error');
    }
  };

  // Авторизация
  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: passwordInput })
      });
      
      if (res.ok) {
        sessionStorage.setItem('app_authenticated', 'true');
        sessionStorage.setItem('app_password', passwordInput);
        setIsAuthenticated(true);
        setLoginError('');
      } else {
        setLoginError('Неверный пароль доступа');
      }
    } catch (err) {
      setLoginError('Сервер базы данных недоступен');
    }
  };

  const handleLogout = () => {
    sessionStorage.clear();
    setIsAuthenticated(false);
  };

  // Метрики доходности товара
  const getProfitMetrics = (price, cost) => {
    const profit = price - cost;
    const marginPercent = price > 0 ? (profit / price) * 100 : 0;
    return {
      profit,
      marginPercent: marginPercent.toFixed(1)
    };
  };

  // Генератор случайных кодов
  const generateRandomCodes = () => {
    const randomInt = 'INT-' + Math.floor(10000 + Math.random() * 90000);
    const randomGov = 'GOV-' + Math.floor(10000000 + Math.random() * 90000000);
    setNewProduct(prev => ({
      ...prev,
      internalCode: randomInt,
      govCode: randomGov
    }));
  };

  // Создание нового товара на сервере
  const handleAddProduct = async (e) => {
    e.preventDefault();
    if (!newProduct.name.trim()) return;

    const finalProduct = {
      ...newProduct,
      id: 'prod-' + Date.now(),
      internalCode: newProduct.internalCode.trim() || 'INT-' + Math.floor(10000 + Math.random() * 90000),
      govCode: newProduct.govCode.trim() || 'GOV-' + Math.floor(10000000 + Math.random() * 90000000),
      quantity: Number(newProduct.quantity) || 0,
      price: Number(newProduct.price) || 0,
      cost: Number(newProduct.cost) || 0
    };

    try {
      const res = await fetch(`${API_URL}/products`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': currentPassword
        },
        body: JSON.stringify(finalProduct)
      });

      if (res.ok) {
        setIsAddProductOpen(false);
        setNewProduct({ name: '', internalCode: '', govCode: '', quantity: 0, price: 0, cost: 0, categoryId: categories[0]?.id || '' });
        showToast(`Товар "${finalProduct.name}" успешно добавлен в базу`);
        fetchData();
      }
    } catch (err) {
      showToast('Не удалось сохранить товар на сервере', 'error');
    }
  };

  // Быстрое редактирование любого параметра прямо в таблице
  const handleInlineSave = async (productId, field) => {
    let finalValue = inlineEditState.value;

    if (field !== 'categoryId') {
      finalValue = Number(finalValue);
      if (isNaN(finalValue) || finalValue < 0) {
        showToast('Введите корректное число', 'error');
        return;
      }
    }

    try {
      const res = await fetch(`${API_URL}/products/${productId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': currentPassword
        },
        body: JSON.stringify({ field, value: finalValue })
      });

      if (res.ok) {
        setInlineEditState({ productId: null, field: null, value: '' });
        showToast('Данные успешно сохранены на сервере');
        fetchData();
      }
    } catch (err) {
      showToast('Ошибка изменения данных на сервере', 'error');
    }
  };

  // Удаление товара из базы данных
  const handleDeleteProduct = async (prodId, name) => {
    if (confirm(`Вы действительно хотите удалить товар "${name}"?`)) {
      try {
        const res = await fetch(`${API_URL}/products/${prodId}`, {
          method: 'DELETE',
          headers: { 'Authorization': currentPassword }
        });
        if (res.ok) {
          showToast(`Товар "${name}" удален`);
          fetchData();
        }
      } catch (err) {
        showToast('Ошибка удаления', 'error');
      }
    }
  };
// --- ДОБАВИТЬ ФУНКЦИИ В APP.JSX ---

  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;

    const colors = [
      'bg-red-100 text-red-800 border-red-200',
      'bg-orange-100 text-orange-800 border-orange-200',
      'bg-emerald-100 text-emerald-800 border-emerald-200',
      'bg-blue-100 text-blue-800 border-blue-200',
      'bg-purple-100 text-purple-800 border-purple-200',
      'bg-pink-100 text-pink-800 border-pink-200'
    ];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    const newCategory = { id: 'cat-' + Date.now(), name: newCategoryName.trim(), color: randomColor };

    try {
      const res = await fetch(`${API_URL}/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': currentPassword },
        body: JSON.stringify(newCategory)
      });
      if (res.ok) {
        setNewCategoryName('');
        showToast(`Категория "${newCategory.name}" создана`);
        fetchData(); // Обновляем базу
      }
    } catch (err) {
      showToast('Ошибка при добавлении категории', 'error');
    }
  };

  const handleDeleteCategory = async (catId) => {
    try {
      const res = await fetch(`${API_URL}/categories/${catId}`, {
        method: 'DELETE',
        headers: { 'Authorization': currentPassword }
      });
      if (res.ok) {
        showToast('Категория удалена', 'warning');
        fetchData(); // Обновляем базу, чтобы товары потеряли привязку
      }
    } catch (err) {
      showToast('Ошибка удаления', 'error');
    }
  };
  // Обработка клика по заголовку таблицы для сортировки
  const requestSort = (key) => {
    let direction = 'asc';
    if (sortBy === key && sortOrder === 'asc') {
      direction = 'desc';
    }
    setSortBy(key);
    setSortOrder(direction);
  };

  // Фильтрация и сортировка массива перед рендером таблицы
  const filteredProducts = products.filter(p => {
    const matchesSearch = 
      p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.internalCode?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.govCode?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = 
      selectedCategoryFilter === 'all' || 
      (selectedCategoryFilter === 'none' && !p.categoryId) ||
      p.categoryId === selectedCategoryFilter;

    return matchesSearch && matchesCategory;
  });

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    let aValue, bValue;
    if (sortBy === 'profitability') {
      aValue = Number(getProfitMetrics(a.price, a.cost).marginPercent);
      bValue = Number(getProfitMetrics(b.price, b.cost).marginPercent);
    } else {
      aValue = a[sortBy] ?? '';
      bValue = b[sortBy] ?? '';
    }

    if (typeof aValue === 'string') {
      return sortOrder === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
    } else {
      return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
    }
  });

  // Расчет общих финансовых показателей
  const stats = React.useMemo(() => {
    let totalQty = 0;
    let totalRetailValue = 0;
    let totalCostValue = 0;
    let lowStockCount = 0;

    products.forEach(p => {
      totalQty += p.quantity;
      totalRetailValue += p.price * p.quantity;
      totalCostValue += p.cost * p.quantity;
      if (p.quantity <= 10) lowStockCount++;
    });

    const expectedProfit = totalRetailValue - totalCostValue;
    const averageMargin = totalRetailValue > 0 ? (expectedProfit / totalRetailValue) * 100 : 0;

    return { totalQty, totalRetailValue, expectedProfit, averageMargin: averageMargin.toFixed(1), lowStockCount };
  }, [products]);

  // Вызов Gemini API нейросети для анализа остатков
  const handleAiAnalysis = async () => {
    setIsAiModalOpen(true);
    setIsAiLoading(true);
    setAiResponse('');

    const apiKey = "AQ.Ab8RN6JdmH0WmHQN1p1mkbRQNdoIya1MWJv0U0kTYqXHbMImPQ"; // Ключ подставляется автоматически вашей платформой
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const promptText = `Ты бизнес-аналитик. Проанализируй текущие запасы склада и дай 2-3 практических емких совета.
Всего позиций: ${products.length}. Общая стоимость: ${stats.totalRetailValue} тг. Ожидаемая чистая прибыль: ${stats.expectedProfit} тг.
Данные: ${JSON.stringify(products.map(p => ({ n: p.name, q: p.quantity, m: getProfitMetrics(p.price, p.cost).marginPercent + '%' })))}
Отвечай коротко, структурировано, на русском языке.`;

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptText }] }],
          systemInstruction: { parts: [{ text: "Ты эксперт по анализу складских остатков и торговой маржи." }] }
        })
      });
      const data = await res.json();
      setAiResponse(data.candidates?.[0]?.content?.parts?.[0]?.text || "Нейросеть не смогла сформировать ответ.");
    } catch (err) {
      setAiResponse("Ошибка связи с сервером AI. Попробуйте выполнить запрос позже.");
    } finally {
      setIsAiLoading(false);
    }
  };

  // ЭКРАН 1: Форма входа по общему паролю
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 antialiased font-sans">
        <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-200 max-w-sm w-full space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold text-slate-900">Складской Учет Pro</h2>
            <p className="text-xs text-slate-500">Вход в защищенную облачную базу данных</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Пароль доступа</label>
              <input
                type="password"
                placeholder="Введите пароль системы"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm"
              />
            </div>
            {loginError && <p className="text-xs text-rose-600 font-medium text-center">{loginError}</p>}
            <button
              type="submit"
              className="w-full py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md transition-colors"
            >
              Подключиться к базе данных
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ЭКРАН 2: Полноценный рабочий интерфейс приложения
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 antialiased font-sans">
      {/* Шапка */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 text-white p-2.5 rounded-xl shadow-md shadow-indigo-100">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 leading-tight">Складской Учет Pro</h1>
              <p className="text-xs text-slate-500">Синхронизированная база данных</p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleAiAnalysis}
              className="px-4 py-2 text-sm font-semibold text-fuchsia-700 bg-fuchsia-50 border border-fuchsia-200 rounded-lg hover:bg-fuchsia-100 focus:outline-none focus:ring-2 focus:ring-fuchsia-500 transition-colors flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              AI-Аналитик
            </button>
            <button
              onClick={() => setIsManageCategoriesOpen(true)}
              className="px-4 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors flex items-center gap-2"
            >
              Категории ({categories.length})
            </button>
            <button
              onClick={() => setIsAddProductOpen(true)}
              className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-md transition-colors flex items-center gap-2"
            >
              Добавить товар
            </button>
            <button
              onClick={handleLogout}
              className="px-3 py-2 text-sm font-semibold text-slate-500 hover:text-rose-600 border border-slate-300 bg-white rounded-lg hover:bg-rose-50 transition-colors"
            >
              Выйти
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        {/* Аналитика */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center space-x-4">
            <div className="p-3 rounded-xl bg-indigo-50 text-indigo-600"><strong>₸</strong></div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Общая стоимость склада</p>
              <p className="text-xl font-bold text-slate-900 mt-1">{stats.totalRetailValue.toLocaleString()} ₸</p>
              <p className="text-[10px] text-slate-400 mt-0.5">{stats.totalQty} шт. на балансе</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center space-x-4">
            <div className="p-3 rounded-xl bg-emerald-50 text-emerald-600"><strong>▲</strong></div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Чистая прибыль</p>
              <p className="text-xl font-bold text-slate-900 mt-1">{stats.expectedProfit.toLocaleString()} ₸</p>
              <p className="text-[10px] text-emerald-600 font-medium mt-0.5">При полной продаже</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center space-x-4">
            <div className="p-3 rounded-xl bg-amber-50 text-amber-600"><strong>%</strong></div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Средняя доходность</p>
              <p className="text-xl font-bold text-slate-900 mt-1">{stats.averageMargin}%</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Маржинальность склада</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center space-x-4">
            <div className={`p-3 rounded-xl ${stats.lowStockCount > 0 ? 'bg-rose-50 text-rose-600' : 'bg-slate-50 text-slate-400'}`}><strong>!</strong></div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Заканчиваются товары</p>
              <p className="text-xl font-bold text-slate-900 mt-1">{stats.lowStockCount} наименований</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Остаток на складе ≤ 10 шт.</p>
            </div>
          </div>
        </div>

        {/* Уведомления */}
        {notification && (
          <div className={`p-4 rounded-xl border font-medium text-sm text-center ${notification.type === 'error' ? 'bg-red-50 text-red-800 border-red-200' : 'bg-emerald-50 text-emerald-800 border-emerald-200'}`}>
            {notification.message}
          </div>
        )}

        {/* Поиск и Фильтр */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between gap-4">
          <input
            type="text"
            placeholder="Поиск по наименованию, внутреннему или гос. коду..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-4 py-2 w-full bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
          />
          <select
            value={selectedCategoryFilter}
            onChange={(e) => setSelectedCategoryFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none"
          >
            <option value="all">Все категории</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            <option value="none">Без категории</option>
          </select>
        </div>

        {/* Главная динамическая таблица */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th onClick={() => requestSort('name')} className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase cursor-pointer hover:bg-slate-100">Наименование {sortBy === 'name' && (sortOrder === 'asc' ? '▲' : '▼')}</th>
                  <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase">Коды (Внут. / Гос.)</th>
                  <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase">Категория</th>
                  <th onClick={() => requestSort('quantity')} className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase cursor-pointer hover:bg-slate-100">Кол-во {sortBy === 'quantity' && (sortOrder === 'asc' ? '▲' : '▼')}</th>
                  <th onClick={() => requestSort('price')} className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase cursor-pointer hover:bg-slate-100">Цена продажи {sortBy === 'price' && (sortOrder === 'asc' ? '▲' : '▼')}</th>
                  <th onClick={() => requestSort('cost')} className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase cursor-pointer hover:bg-slate-100">Себестоимость {sortBy === 'cost' && (sortOrder === 'asc' ? '▲' : '▼')}</th>
                  <th onClick={() => requestSort('profitability')} className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase cursor-pointer hover:bg-slate-100">Доходность {sortBy === 'profitability' && (sortOrder === 'asc' ? '▲' : '▼')}</th>
                  <th className="relative px-6 py-3.5"><span className="sr-only">Действия</span></th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {sortedProducts.map((p) => {
                  const cat = categories.find(c => c.id === p.categoryId);
                  const { profit, marginPercent } = getProfitMetrics(p.price, p.cost);
                  return (
                    <tr key={p.id} className="hover:bg-slate-50 group">
                      <td className="px-6 py-4 whitespace-nowrap"><div className="font-semibold text-slate-900">{p.name}</div></td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs font-mono text-slate-500"><div>{p.internalCode}</div><div className="text-[10px] text-slate-400">{p.govCode}</div></td>
                      
                      {/* Категория с быстрым редактированием */}
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {inlineEditState.productId === p.id && inlineEditState.field === 'categoryId' ? (
                          <div className="flex items-center gap-1">
                            <select
                              value={inlineEditState.value}
                              onChange={(e) => setInlineEditState({ ...inlineEditState, value: e.target.value })}
                              className="border border-indigo-500 rounded p-1 text-xs bg-white focus:outline-none"
                            >
                              <option value="">Без категории</option>
                              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                            <button onClick={() => handleInlineSave(p.id, 'categoryId')} className="p-1 bg-emerald-500 text-white rounded text-xs">✓</button>
                          </div>
                        ) : (
                          <div className="flex items-center space-x-2">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${cat ? cat.color : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                              {cat ? cat.name : 'Без категории'}
                            </span>
                            <button onClick={() => setInlineEditState({ productId: p.id, field: 'categoryId', value: p.categoryId || '' })} className="text-slate-400 hover:text-indigo-600 opacity-0 group-hover:opacity-100 text-xs">✏️</button>
                          </div>
                        )}
                      </td>

                      {/* Количество с быстрым редактированием */}
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {inlineEditState.productId === p.id && inlineEditState.field === 'quantity' ? (
                          <div className="flex items-center gap-1">
                            <input type="number" value={inlineEditState.value} onChange={(e) => setInlineEditState({ ...inlineEditState, value: e.target.value })} className="w-16 border border-indigo-500 rounded text-center p-1" />
                            <button onClick={() => handleInlineSave(p.id, 'quantity')} className="p-1 bg-emerald-500 text-white rounded text-xs">✓</button>
                          </div>
                        ) : (
                          <div className="flex items-center space-x-2">
                            <span className={p.quantity <= 10 ? "text-rose-600 font-bold" : "text-slate-800 font-medium"}>{p.quantity} шт.</span>
                            <button onClick={() => setInlineEditState({ productId: p.id, field: 'quantity', value: p.quantity.toString() })} className="text-slate-400 hover:text-indigo-600 opacity-0 group-hover:opacity-100 text-xs">✏️</button>
                          </div>
                        )}
                      </td>

                      {/* Цена продажи с быстрым редактированием */}
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {inlineEditState.productId === p.id && inlineEditState.field === 'price' ? (
                          <div className="flex items-center gap-1">
                            <input type="number" value={inlineEditState.value} onChange={(e) => setInlineEditState({ ...inlineEditState, value: e.target.value })} className="w-20 border border-indigo-500 rounded text-center p-1" />
                            <button onClick={() => handleInlineSave(p.id, 'price')} className="p-1 bg-emerald-500 text-white rounded text-xs">✓</button>
                          </div>
                        ) : (
                          <div className="flex items-center space-x-2">
                            <span className="font-semibold">{p.price.toLocaleString()} ₸</span>
                            <button onClick={() => setInlineEditState({ productId: p.id, field: 'price', value: p.price.toString() })} className="text-slate-400 hover:text-indigo-600 opacity-0 group-hover:opacity-100 text-xs">✏️</button>
                          </div>
                        )}
                      </td>

                      {/* Себестоимость с быстрым редактированием */}
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {inlineEditState.productId === p.id && inlineEditState.field === 'cost' ? (
                          <div className="flex items-center gap-1">
                            <input type="number" value={inlineEditState.value} onChange={(e) => setInlineEditState({ ...inlineEditState, value: e.target.value })} className="w-20 border border-indigo-500 rounded text-center p-1" />
                            <button onClick={() => handleInlineSave(p.id, 'cost')} className="p-1 bg-emerald-500 text-white rounded text-xs">✓</button>
                          </div>
                        ) : (
                          <div className="flex items-center space-x-2">
                            <span>{p.cost.toLocaleString()} ₸</span>
                            <button onClick={() => setInlineEditState({ productId: p.id, field: 'cost', value: p.cost.toString() })} className="text-slate-400 hover:text-indigo-600 opacity-0 group-hover:opacity-100 text-xs">✏️</button>
                          </div>
                        )}
                      </td>

                      {/* Расчет доходности */}
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="font-semibold text-emerald-600">+{profit.toLocaleString()} ₸</div>
                        <div className="text-xs text-indigo-600 font-bold bg-indigo-50 border border-indigo-100 px-1.5 py-0.2 rounded inline-block mt-0.5">{marginPercent}% маржа</div>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        <button onClick={() => handleDeleteProduct(p.id, p.name)} className="text-rose-600 hover:text-rose-900 font-medium">Удалить</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* МОДАЛЬНОЕ ОКНО: Добавить новый товар */}
      {isAddProductOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Новый товар в систему</h3>
            <form onSubmit={handleAddProduct} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Наименование товара *</label>
                <input type="text" required value={newProduct.name} onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <input type="text" placeholder="Внутренний код" value={newProduct.internalCode} onChange={(e) => setNewProduct({ ...newProduct, internalCode: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono" />
                <input type="text" placeholder="Гос. код товара" value={newProduct.govCode} onChange={(e) => setNewProduct({ ...newProduct, govCode: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono" />
              </div>
              <button type="button" onClick={generateRandomCodes} className="text-xs text-indigo-600 hover:underline font-medium block">Сгенерировать случайные коды</button>
              
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Категория</label>
                <select value={newProduct.categoryId} onChange={(e) => setNewProduct({ ...newProduct, categoryId: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none">
                  <option value="">Без категории</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <input type="number" placeholder="Кол-во" value={newProduct.quantity || ''} onChange={(e) => setNewProduct({ ...newProduct, quantity: Number(e.target.value) })} className="w-full px-2 py-2 border border-slate-300 rounded-xl text-center" />
                <input type="number" placeholder="Цена (₸)" value={newProduct.price || ''} onChange={(e) => setNewProduct({ ...newProduct, price: Number(e.target.value) })} className="w-full px-2 py-2 border border-slate-300 rounded-xl text-center" />
                <input type="number" placeholder="Себест. (₸)" value={newProduct.cost || ''} onChange={(e) => setNewProduct({ ...newProduct, cost: Number(e.target.value) })} className="w-full px-2 py-2 border border-slate-300 rounded-xl text-center" />
              </div>

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setIsAddProductOpen(false)} className="flex-1 py-2 text-sm font-semibold bg-slate-100 hover:bg-slate-200 rounded-xl">Отмена</button>
                <button type="submit" className="flex-1 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md">Создать</button>
              </div>
            </form>
          </div>
        </div>
      )}
{/* МОДАЛЬНОЕ ОКНО: Управление категориями */}
      {isManageCategoriesOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="text-lg font-bold text-slate-900">Управление категориями</h3>
              <button onClick={() => setIsManageCategoriesOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>
            
            <form onSubmit={handleAddCategory} className="flex gap-2">
              <input 
                type="text" 
                required 
                placeholder="Название новой категории..." 
                value={newCategoryName} 
                onChange={(e) => setNewCategoryName(e.target.value)} 
                className="flex-1 px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" 
              />
              <button type="submit" className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700">Создать</button>
            </form>

            <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
              {categories.length > 0 ? categories.map((c) => {
                const count = products.filter(p => p.categoryId === c.id).length;
                return (
                  <div key={c.id} className="flex items-center justify-between p-2 rounded-xl border border-slate-100 hover:bg-slate-50">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${c.color}`}>{c.name}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-400">{count} тов.</span>
                      <button type="button" onClick={() => handleDeleteCategory(c.id)} className="text-rose-500 hover:text-rose-700 text-xs font-medium">Удалить</button>
                    </div>
                  </div>
                );
              }) : <p className="text-xs text-slate-400 text-center py-2">Категории не созданы</p>}
            </div>
          </div>
        </div>
      )}
      {/* МОДАЛЬНОЕ ОКНО: AI-Аналитик */}
      {isAiModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Бизнес-Аналитик (AI)</h3>
            <div className="min-h-[150px] flex items-center justify-center bg-slate-50 rounded-xl p-4 border border-slate-100">
              {isAiLoading ? (
                <p className="text-sm text-slate-500 font-medium animate-pulse">Формирую аналитический отчёт по складу...</p>
              ) : (
                <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap w-full">{aiResponse}</div>
              )}
            </div>
            <div className="flex justify-end">
              <button type="button" onClick={() => setIsAiModalOpen(false)} className="px-5 py-2 text-sm font-semibold bg-slate-100 hover:bg-slate-200 rounded-xl">Закрыть</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}