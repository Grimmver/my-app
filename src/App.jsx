import React, { useState, useEffect } from 'react';

// Начальные демонстрационные данные
const DEFAULT_CATEGORIES = [
  { id: '1', name: 'Электроника', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  { id: '2', name: 'Одежда', color: 'bg-purple-100 text-purple-800 border-purple-200' },
  { id: '3', name: 'Продукты', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  { id: '4', name: 'Канцелярия', color: 'bg-amber-100 text-amber-800 border-amber-200' }
];

const DEFAULT_PRODUCTS = [
  {
    id: 'prod-1',
    name: 'Смартфон X-Phone 14',
    internalCode: 'INT-40921',
    govCode: 'GOV-89401294',
    quantity: 15,
    price: 75000,
    cost: 52000,
    categoryId: '1'
  },
  {
    id: 'prod-2',
    name: 'Футболка хлопковая черная',
    internalCode: 'INT-11234',
    govCode: 'GOV-33491204',
    quantity: 120,
    price: 1500,
    cost: 650,
    categoryId: '2'
  },
  {
    id: 'prod-3',
    name: 'Кофе зерновой Arabica 1кг',
    internalCode: 'INT-88492',
    govCode: 'GOV-44120934',
    quantity: 45,
    price: 2400,
    cost: 1100,
    categoryId: '3'
  },
  {
    id: 'prod-4',
    name: 'Набор гелевых ручек (12 шт)',
    internalCode: 'INT-33049',
    govCode: 'GOV-55102934',
    quantity: 8,
    price: 450,
    cost: 180,
    categoryId: '4'
  }
];

export default function App() {
  // Инициализация состояний из localStorage (или дефолтных значений)
  const [categories, setCategories] = useState(() => {
    const saved = localStorage.getItem('db_categories');
    return saved ? JSON.parse(saved) : DEFAULT_CATEGORIES;
  });

  const [products, setProducts] = useState(() => {
    const saved = localStorage.getItem('db_products');
    return saved ? JSON.parse(saved) : DEFAULT_PRODUCTS;
  });

  // Синхронизация с localStorage при изменениях
  useEffect(() => {
    localStorage.setItem('db_categories', JSON.stringify(categories));
  }, [categories]);

  useEffect(() => {
    localStorage.setItem('db_products', JSON.stringify(products));
  }, [products]);

  // Фильтры, поиск и сортировка
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');

  // Состояния для модальных окон
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [isManageCategoriesOpen, setIsManageCategoriesOpen] = useState(false);
  const [notification, setNotification] = useState(null);

  // Форма нового товара
  const [newProduct, setNewProduct] = useState({
    name: '',
    internalCode: '',
    govCode: '',
    quantity: 0,
    price: 0,
    cost: 0,
    categoryId: ''
  });

  // Форма новой категории
  const [newCategoryName, setNewCategoryName] = useState('');

  // Быстрое редактирование прямо в таблице
  const [inlineEditState, setInlineEditState] = useState({
    productId: null,
    field: null, // 'quantity' | 'price' | 'cost' | 'categoryId'
    value: ''
  });

  // Состояния для AI Аналитика
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState('');

  // Вспомогательная функция для всплывающих уведомлений
  const showToast = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // Расчет маржинальности и доходности
  const getProfitMetrics = (price, cost) => {
    const profit = price - cost;
    const marginPercent = price > 0 ? (profit / price) * 100 : 0;
    return {
      profit, // Абсолютная прибыль на ед.
      marginPercent: marginPercent.toFixed(1) // Процент доходности (маржа)
    };
  };

  // Генераторы случайных кодов
  const generateRandomCodes = () => {
    const randomInt = 'INT-' + Math.floor(10000 + Math.random() * 90000);
    const randomGov = 'GOV-' + Math.floor(10000000 + Math.random() * 90000000);
    setNewProduct(prev => ({
      ...prev,
      internalCode: randomInt,
      govCode: randomGov
    }));
  };

  // Добавление новой категории
  const handleAddCategory = (e) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;

    // Список случайных Tailwind цветов для тегов категорий
    const colors = [
      'bg-red-100 text-red-800 border-red-200',
      'bg-orange-100 text-orange-800 border-orange-200',
      'bg-yellow-100 text-yellow-800 border-yellow-200',
      'bg-green-100 text-green-800 border-green-200',
      'bg-teal-100 text-teal-800 border-teal-200',
      'bg-sky-100 text-sky-800 border-sky-200',
      'bg-indigo-100 text-indigo-800 border-indigo-200',
      'bg-pink-100 text-pink-800 border-pink-200'
    ];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    const id = 'cat-' + Date.now();
    const createdCategory = {
      id,
      name: newCategoryName.trim(),
      color: randomColor
    };

    setCategories([...categories, createdCategory]);
    setNewCategoryName('');
    showToast(`Категория "${createdCategory.name}" успешно создана`);
  };

  // Удаление категории (с очисткой у товаров этой категории)
  const handleDeleteCategory = (catId) => {
    setCategories(categories.filter(c => c.id !== catId));
    setProducts(products.map(p => p.categoryId === catId ? { ...p, categoryId: '' } : p));
    showToast('Категория удалена. Товары перенесены в раздел "Без категории"', 'warning');
  };

  // Добавление нового товара
  const handleAddProduct = (e) => {
    e.preventDefault();
    if (!newProduct.name.trim()) {
      showToast('Заполните наименование товара', 'error');
      return;
    }

    const finalProduct = {
      ...newProduct,
      id: 'prod-' + Date.now(),
      internalCode: newProduct.internalCode.trim() || 'INT-' + Math.floor(10000 + Math.random() * 90000),
      govCode: newProduct.govCode.trim() || 'GOV-' + Math.floor(10000000 + Math.random() * 90000000),
      quantity: Number(newProduct.quantity) || 0,
      price: Number(newProduct.price) || 0,
      cost: Number(newProduct.cost) || 0
    };

    setProducts([...products, finalProduct]);
    setIsAddProductOpen(false);
    setNewProduct({
      name: '',
      internalCode: '',
      govCode: '',
      quantity: 0,
      price: 0,
      cost: 0,
      categoryId: categories[0]?.id || ''
    });
    showToast(`Товар "${finalProduct.name}" добавлен в базу данных`);
  };

  // Удаление товара
  const handleDeleteProduct = (prodId, name) => {
    if (confirm(`Вы действительно хотите удалить товар "${name}"?`)) {
      setProducts(products.filter(p => p.id !== prodId));
      showToast(`Товар "${name}" удален`);
    }
  };

  // Сохранение отредактированного значения прямо в таблице
  const handleInlineSave = (productId, field) => {
    if (field === 'categoryId') {
      setProducts(products.map(p => {
        if (p.id === productId) {
          return { ...p, categoryId: inlineEditState.value };
        }
        return p;
      }));
      setInlineEditState({ productId: null, field: null, value: '' });
      showToast('Категория товара обновлена');
      return;
    }

    let numericValue = Number(inlineEditState.value);
    if (isNaN(numericValue) || numericValue < 0) {
      showToast('Введите корректное неотрицательное число', 'error');
      return;
    }

    setProducts(products.map(p => {
      if (p.id === productId) {
        return {
          ...p,
          [field]: numericValue
        };
      }
      return p;
    }));

    setInlineEditState({ productId: null, field: null, value: '' });
    showToast('Параметр успешно обновлен');
  };

  // Переключение сортировки
  const requestSort = (key) => {
    let direction = 'asc';
    if (sortBy === key && sortOrder === 'asc') {
      direction = 'desc';
    }
    setSortBy(key);
    setSortOrder(direction);
  };

  // Фильтрация и сортировка данных перед отображением
  const filteredProducts = products.filter(p => {
    const matchesSearch = 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.internalCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.govCode.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = 
      selectedCategoryFilter === 'all' || 
      (selectedCategoryFilter === 'none' && !p.categoryId) ||
      p.categoryId === selectedCategoryFilter;

    return matchesSearch && matchesCategory;
  });

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    let aValue, bValue;

    if (sortBy === 'profitability') {
      // Сортировка по % маржинальности
      aValue = Number(getProfitMetrics(a.price, a.cost).marginPercent);
      bValue = Number(getProfitMetrics(b.price, b.cost).marginPercent);
    } else {
      aValue = a[sortBy];
      bValue = b[sortBy];
    }

    if (typeof aValue === 'string') {
      return sortOrder === 'asc' 
        ? aValue.localeCompare(bValue) 
        : bValue.localeCompare(aValue);
    } else {
      return sortOrder === 'asc' 
        ? aValue - bValue 
        : bValue - aValue;
    }
  });

  // Расчет общих показателей для аналитической панели
  const stats = React.useMemo(() => {
    let totalQty = 0;
    let totalRetailValue = 0;
    let totalCostValue = 0;
    let lowStockCount = 0;

    products.forEach(p => {
      totalQty += p.quantity;
      totalRetailValue += p.price * p.quantity;
      totalCostValue += p.cost * p.quantity;
      if (p.quantity <= 10) {
        lowStockCount++;
      }
    });

    const expectedProfit = totalRetailValue - totalCostValue;
    const averageMargin = totalRetailValue > 0 ? (expectedProfit / totalRetailValue) * 100 : 0;

    return {
      totalQty,
      totalRetailValue,
      expectedProfit,
      averageMargin: averageMargin.toFixed(1),
      lowStockCount
    };
  }, [products]);

  // Вызов Gemini API для анализа склада
  const handleAiAnalysis = async () => {
    setIsAiModalOpen(true);
    setIsAiLoading(true);
    setAiResponse('');

    const apiKey = ""; // API-ключ будет подставлен средой автоматически
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;

    const promptText = `Ты бизнес-аналитик. Проанализируй этот склад и дай 2-3 коротких и емких совета по улучшению продаж или управлению запасами.
Всего товаров: ${products.length}. Общая стоимость: ${stats.totalRetailValue} тг.
Ожидаемая прибыль: ${stats.expectedProfit} тг.
Данные товаров: ${JSON.stringify(products.map(p => ({
  название: p.name,
  количество: p.quantity,
  маржа: getProfitMetrics(p.price, p.cost).marginPercent + '%'
})))}
Отвечай кратко на русском языке. Укажи на проблемные места, если они есть.`;

    const fetchWithRetry = async (url, options, retries = 5) => {
      const delays = [1000, 2000, 4000, 8000, 16000];
      for (let i = 0; i < retries; i++) {
        try {
          const res = await fetch(url, options);
          if (res.ok) return res;
          if (i === retries - 1) throw new Error('API Error');
        } catch (err) {
          if (i === retries - 1) throw err;
          await new Promise(r => setTimeout(r, delays[i]));
        }
      }
    };

    try {
      const res = await fetchWithRetry(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptText }] }],
          systemInstruction: { parts: [{ text: "Ты эксперт по управлению запасами." }] }
        })
      });
      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "Нет ответа от AI.";
      setAiResponse(text);
    } catch (err) {
      setAiResponse("Произошла ошибка при обращении к AI. Пожалуйста, попробуйте позже.");
    } finally {
      setIsAiLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 antialiased font-sans">
      {/* Шапка */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 text-white p-2.5 rounded-xl shadow-md shadow-indigo-100">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 leading-tight">Складской Учет Pro</h1>
              <p className="text-xs text-slate-500">Динамическое управление базой данных товаров</p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleAiAnalysis}
              className="px-4 py-2 text-sm font-semibold text-fuchsia-700 bg-fuchsia-50 border border-fuchsia-200 rounded-lg hover:bg-fuchsia-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-fuchsia-500 transition-colors flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              AI-Аналитик
            </button>
            <button
              onClick={() => setIsManageCategoriesOpen(true)}
              className="px-4 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Категории ({categories.length})
            </button>
            <button
              onClick={() => {
                setNewProduct(prev => ({ ...prev, categoryId: categories[0]?.id || '' }));
                setIsAddProductOpen(true);
              }}
              className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 shadow-md shadow-indigo-100 transition-colors flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Добавить товар
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        
        {/* Панель аналитики (Stats Dashboard) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center space-x-4">
            <div className="p-3 rounded-xl bg-indigo-50 text-indigo-600">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Общая стоимость склада</p>
              <p className="text-xl font-bold text-slate-900 mt-1">{stats.totalRetailValue.toLocaleString()} ₸</p>
              <p className="text-[10px] text-slate-400 mt-0.5">{stats.totalQty} шт. на балансе</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center space-x-4">
            <div className="p-3 rounded-xl bg-emerald-50 text-emerald-600">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Ожидаемая чистая прибыль</p>
              <p className="text-xl font-bold text-slate-900 mt-1">{stats.expectedProfit.toLocaleString()} ₸</p>
              <p className="text-[10px] text-emerald-600 font-medium mt-0.5">При полной продаже запасов</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center space-x-4">
            <div className="p-3 rounded-xl bg-amber-50 text-amber-600">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Средняя доходность</p>
              <p className="text-xl font-bold text-slate-900 mt-1">{stats.averageMargin}%</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Средняя маржинальность товаров</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center space-x-4">
            <div className={`p-3 rounded-xl ${stats.lowStockCount > 0 ? 'bg-rose-50 text-rose-600' : 'bg-slate-50 text-slate-400'}`}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Заканчиваются товары</p>
              <p className="text-xl font-bold text-slate-900 mt-1">{stats.lowStockCount} наименований</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Количество на складе ≤ 10 шт.</p>
            </div>
          </div>
        </div>

        {/* Уведомление в верху экрана */}
        {notification && (
          <div className={`p-4 rounded-xl flex items-center justify-between border shadow-sm transition-all duration-300 ${
            notification.type === 'error' ? 'bg-red-50 text-red-800 border-red-200' :
            notification.type === 'warning' ? 'bg-amber-50 text-amber-800 border-amber-200' :
            'bg-emerald-50 text-emerald-800 border-emerald-200'
          }`}>
            <span className="text-sm font-medium">{notification.message}</span>
            <button onClick={() => setNotification(null)} className="p-1 hover:bg-black/5 rounded">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Фильтры и Поиск */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input
              type="text"
              placeholder="Поиск по наименованию, внутреннему или гос. коду..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 w-full bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-sm transition-all"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">Категория:</span>
            <select
              value={selectedCategoryFilter}
              onChange={(e) => setSelectedCategoryFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
            >
              <option value="all">Все категории</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
              <option value="none">Без категории</option>
            </select>

            {(searchQuery || selectedCategoryFilter !== 'all') && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategoryFilter('all');
                }}
                className="text-xs text-indigo-600 font-semibold hover:text-indigo-800 underline pl-1"
              >
                Сбросить фильтры
              </button>
            )}
          </div>
        </div>

        {/* Главная Таблица */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th 
                    scope="col" 
                    className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors"
                    onClick={() => requestSort('name')}
                  >
                    <div className="flex items-center gap-1.5">
                      Наименование
                      {sortBy === 'name' && (sortOrder === 'asc' ? '▲' : '▼')}
                    </div>
                  </th>
                  <th scope="col" className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Коды (Внут. / Гос.)
                  </th>
                  <th 
                    scope="col" 
                    className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors"
                    onClick={() => requestSort('categoryId')}
                  >
                    <div className="flex items-center gap-1.5">
                      Категория
                      {sortBy === 'categoryId' && (sortOrder === 'asc' ? '▲' : '▼')}
                    </div>
                  </th>
                  <th 
                    scope="col" 
                    className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors"
                    onClick={() => requestSort('quantity')}
                  >
                    <div className="flex items-center gap-1.5">
                      Кол-во
                      {sortBy === 'quantity' && (sortOrder === 'asc' ? '▲' : '▼')}
                    </div>
                  </th>
                  <th 
                    scope="col" 
                    className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors"
                    onClick={() => requestSort('price')}
                  >
                    <div className="flex items-center gap-1.5">
                      Розничная цена
                      {sortBy === 'price' && (sortOrder === 'asc' ? '▲' : '▼')}
                    </div>
                  </th>
                  <th 
                    scope="col" 
                    className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors"
                    onClick={() => requestSort('cost')}
                  >
                    <div className="flex items-center gap-1.5">
                      Себестоимость
                      {sortBy === 'cost' && (sortOrder === 'asc' ? '▲' : '▼')}
                    </div>
                  </th>
                  <th 
                    scope="col" 
                    className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors"
                    onClick={() => requestSort('profitability')}
                  >
                    <div className="flex items-center gap-1.5">
                      Доходность (Маржа)
                      {sortBy === 'profitability' && (sortOrder === 'asc' ? '▲' : '▼')}
                    </div>
                  </th>
                  <th scope="col" className="relative px-6 py-3.5">
                    <span className="sr-only">Действия</span>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {sortedProducts.length > 0 ? (
                  sortedProducts.map((p) => {
                    const cat = categories.find(c => c.id === p.categoryId);
                    const { profit, marginPercent } = getProfitMetrics(p.price, p.cost);
                    const isLowStock = p.quantity <= 10;

                    return (
                      <tr key={p.id} className="hover:bg-slate-50 transition-colors group">
                        {/* Наименование */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="font-semibold text-slate-900">{p.name}</div>
                          <div className="text-[10px] text-slate-400 mt-0.5">ID: {p.id}</div>
                        </td>

                        {/* Коды */}
                        <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-600">
                          <div className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-[11px] inline-block mb-1 border border-slate-200">
                            {p.internalCode}
                          </div>
                          <div className="font-mono text-[10px] text-slate-400">
                            {p.govCode}
                          </div>
                        </td>

                        {/* Категория с быстрым редактированием */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          {inlineEditState.productId === p.id && inlineEditState.field === 'categoryId' ? (
                            <div className="flex items-center gap-1">
                              <select
                                value={inlineEditState.value}
                                autoFocus
                                onChange={(e) => setInlineEditState({ ...inlineEditState, value: e.target.value })}
                                onKeyDown={(e) => e.key === 'Enter' && handleInlineSave(p.id, 'categoryId')}
                                className="w-full min-w-[120px] px-1.5 py-1 border border-indigo-500 rounded text-xs focus:outline-none bg-white"
                              >
                                <option value="">Без категории</option>
                                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                              </select>
                              <button 
                                onClick={() => handleInlineSave(p.id, 'categoryId')}
                                className="p-1 bg-emerald-500 text-white rounded hover:bg-emerald-600 shrink-0"
                              >
                                ✓
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center space-x-2">
                              {cat ? (
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${cat.color}`}>
                                  {cat.name}
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200">
                                  Без категории
                                </span>
                              )}
                              <button
                                onClick={() => setInlineEditState({ productId: p.id, field: 'categoryId', value: p.categoryId || '' })}
                                className="text-slate-400 hover:text-indigo-600 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Редактировать категорию"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                  <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                                </svg>
                              </button>
                            </div>
                          )}
                        </td>

                        {/* Количество с быстрым редактированием */}
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {inlineEditState.productId === p.id && inlineEditState.field === 'quantity' ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                value={inlineEditState.value}
                                autoFocus
                                onChange={(e) => setInlineEditState({ ...inlineEditState, value: e.target.value })}
                                onKeyDown={(e) => e.key === 'Enter' && handleInlineSave(p.id, 'quantity')}
                                className="w-16 px-1.5 py-1 border border-indigo-500 rounded text-center focus:outline-none"
                              />
                              <button 
                                onClick={() => handleInlineSave(p.id, 'quantity')}
                                className="p-1 bg-emerald-500 text-white rounded hover:bg-emerald-600"
                              >
                                ✓
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center space-x-2">
                              <span className={`font-bold ${isLowStock ? 'text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-100' : 'text-slate-800'}`}>
                                {p.quantity} шт.
                              </span>
                              <button
                                onClick={() => setInlineEditState({ productId: p.id, field: 'quantity', value: p.quantity.toString() })}
                                className="text-slate-400 hover:text-indigo-600 p-1"
                                title="Редактировать количество"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                  <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                                </svg>
                              </button>
                            </div>
                          )}
                        </td>

                        {/* Розничная цена с быстрым редактированием */}
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {inlineEditState.productId === p.id && inlineEditState.field === 'price' ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                value={inlineEditState.value}
                                autoFocus
                                onChange={(e) => setInlineEditState({ ...inlineEditState, value: e.target.value })}
                                onKeyDown={(e) => e.key === 'Enter' && handleInlineSave(p.id, 'price')}
                                className="w-24 px-1.5 py-1 border border-indigo-500 rounded text-center focus:outline-none"
                              />
                              <button 
                                onClick={() => handleInlineSave(p.id, 'price')}
                                className="p-1 bg-emerald-500 text-white rounded hover:bg-emerald-600"
                              >
                                ✓
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center space-x-2">
                              <span className="font-semibold text-slate-800">{p.price.toLocaleString()} ₸</span>
                              <button
                                onClick={() => setInlineEditState({ productId: p.id, field: 'price', value: p.price.toString() })}
                                className="text-slate-400 hover:text-indigo-600 p-1"
                                title="Редактировать цену"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                  <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                                </svg>
                              </button>
                            </div>
                          )}
                        </td>

                        {/* Себестоимость с быстрым редактированием */}
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {inlineEditState.productId === p.id && inlineEditState.field === 'cost' ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                value={inlineEditState.value}
                                autoFocus
                                onChange={(e) => setInlineEditState({ ...inlineEditState, value: e.target.value })}
                                onKeyDown={(e) => e.key === 'Enter' && handleInlineSave(p.id, 'cost')}
                                className="w-24 px-1.5 py-1 border border-indigo-500 rounded text-center focus:outline-none"
                              />
                              <button 
                                onClick={() => handleInlineSave(p.id, 'cost')}
                                className="p-1 bg-emerald-500 text-white rounded hover:bg-emerald-600"
                              >
                                ✓
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center space-x-2">
                              <span className="text-slate-600">{p.cost.toLocaleString()} ₸</span>
                              <button
                                onClick={() => setInlineEditState({ productId: p.id, field: 'cost', value: p.cost.toString() })}
                                className="text-slate-400 hover:text-indigo-600 p-1"
                                title="Редактировать себестоимость"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                  <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                                </svg>
                              </button>
                            </div>
                          )}
                        </td>

                        {/* Динамическая доходность */}
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <div>
                            <span className="font-semibold text-emerald-600">+{profit.toLocaleString()} ₸</span>{' '}
                            <span className="text-[10px] text-slate-400">/ ед.</span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className={`text-xs font-bold ${
                              Number(marginPercent) > 40 ? 'text-emerald-700 bg-emerald-50 border-emerald-100' :
                              Number(marginPercent) > 20 ? 'text-blue-700 bg-blue-50 border-blue-100' :
                              'text-amber-700 bg-amber-50 border-amber-100'
                            } px-1.5 py-0.2 rounded border text-[11px]`}>
                              {marginPercent}% маржа
                            </span>
                          </div>
                        </td>

                        {/* Действия */}
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            onClick={() => handleDeleteProduct(p.id, p.name)}
                            className="text-rose-600 hover:text-rose-900 p-1.5 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Удалить товар"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="8" className="px-6 py-12 text-center text-slate-500">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0a2 2 0 01-2 2H6a2 2 0 01-2-2m16 0V9a2 2 0 00-2-2H6a2 2 0 00-2 2v4.5m16 0h-1.5m-11 0H4" />
                        </svg>
                        <p className="font-medium text-slate-600">Товары не найдены</p>
                        <p className="text-xs text-slate-400">Попробуйте изменить параметры поиска или добавьте первый товар в выбранную категорию</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* MODAL: Добавить товар */}
      {isAddProductOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-150 pb-4 mb-4">
              <h3 className="text-lg font-bold text-slate-900">Новый товар в систему</h3>
              <button onClick={() => setIsAddProductOpen(false)} className="text-slate-400 hover:text-slate-600">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleAddProduct} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Наименование товара *</label>
                <input
                  type="text"
                  required
                  placeholder="Например, Смартфон X-Phone"
                  value={newProduct.name}
                  onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Внутренний код</label>
                  <input
                    type="text"
                    placeholder="INT-XXXXX (необязательно)"
                    value={newProduct.internalCode}
                    onChange={(e) => setNewProduct({ ...newProduct, internalCode: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Гос. код товара</label>
                  <input
                    type="text"
                    placeholder="GOV-XXXXXXXX (необязательно)"
                    value={newProduct.govCode}
                    onChange={(e) => setNewProduct({ ...newProduct, govCode: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono text-sm"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={generateRandomCodes}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-medium underline"
                >
                  Сгенерировать случайные коды
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Категория</label>
                <select
                  value={newProduct.categoryId}
                  onChange={(e) => setNewProduct({ ...newProduct, categoryId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm"
                >
                  <option value="">Без категории</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Количество</label>
                  <input
                    type="number"
                    min="0"
                    value={newProduct.quantity}
                    onChange={(e) => setNewProduct({ ...newProduct, quantity: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Цена (₸)</label>
                  <input
                    type="number"
                    min="0"
                    value={newProduct.price}
                    onChange={(e) => setNewProduct({ ...newProduct, price: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Себест-сть (₸)</label>
                  <input
                    type="number"
                    min="0"
                    value={newProduct.cost}
                    onChange={(e) => setNewProduct({ ...newProduct, cost: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              {newProduct.price > 0 && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 flex justify-between">
                  <span>Ожидаемая доходность на ед: <strong className="text-emerald-600">+{(newProduct.price - newProduct.cost).toLocaleString()} ₸</strong></span>
                  <span>Маржа: <strong className="text-indigo-600">{getProfitMetrics(newProduct.price, newProduct.cost).marginPercent}%</strong></span>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddProductOpen(false)}
                  className="flex-1 py-2 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md shadow-indigo-100 transition-colors"
                >
                  Создать товар
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Управление категориями */}
      {isManageCategoriesOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-150 pb-4 mb-4">
              <h3 className="text-lg font-bold text-slate-900">Управление категориями</h3>
              <button onClick={() => setIsManageCategoriesOpen(false)} className="text-slate-400 hover:text-slate-600">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Добавление */}
            <form onSubmit={handleAddCategory} className="flex gap-2 mb-6">
              <input
                type="text"
                required
                placeholder="Новая категория..."
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                className="flex-1 px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm"
              />
              <button
                type="submit"
                className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors"
              >
                Создать
              </button>
            </form>

            {/* Список существующих */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Существующие категории ({categories.length})</h4>
              {categories.length > 0 ? (
                <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                  {categories.map((c) => {
                    const count = products.filter(p => p.categoryId === c.id).length;
                    return (
                      <div key={c.id} className="flex items-center justify-between p-2 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${c.color}`}>
                          {c.name}
                        </span>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-slate-400">{count} тов.</span>
                          <button
                            type="button"
                            onClick={() => handleDeleteCategory(c.id)}
                            className="text-rose-500 hover:text-rose-700 p-1"
                            title="Удалить категорию"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">Категории не созданы</p>
              )}
            </div>

            <div className="mt-6">
              <button
                type="button"
                onClick={() => setIsManageCategoriesOpen(false)}
                className="w-full py-2 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: AI-Аналитик */}
      {isAiModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-150 pb-4 mb-4">
              <div className="flex items-center gap-2">
                <div className="bg-fuchsia-100 p-2 rounded-lg text-fuchsia-600">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-slate-900">Бизнес-Аналитик (AI)</h3>
              </div>
              <button onClick={() => setIsAiModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="min-h-[150px] flex items-center justify-center bg-slate-50 rounded-xl p-4 border border-slate-100">
              {isAiLoading ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-4 border-fuchsia-200 border-t-fuchsia-600 rounded-full animate-spin"></div>
                  <p className="text-sm text-slate-500 font-medium">Анализирую данные склада...</p>
                </div>
              ) : (
                <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap w-full">
                  {aiResponse}
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setIsAiModalOpen(false)}
                className="px-5 py-2 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
              >
                Понятно
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}