import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { QRCodeCanvas } from 'qrcode.react';
import BarcodeScanner from 'react-qr-barcode-scanner';

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

  const [selectedProductForQR, setSelectedProductForQR] = useState(null);
  const [lastScanned, setLastScanned] = useState("Наведите на код...");
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
    let rawValue = inlineEditState.value;
    if (typeof rawValue === 'string') {
      rawValue = rawValue.trim();
    }
    let finalValue;

    if (field === 'quantity' || field === 'price' || field === 'cost') {
      finalValue = Number(rawValue) || 0;
      if (isNaN(finalValue) || finalValue < 0) {
        showToast('Введите корректное число', 'error');
        return;
      }
    } else {
      finalValue = String(rawValue);
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
      } else {
        const errData = await res.json();
        showToast(errData.error || 'Ошибка при сохранении', 'error');
      }
    } catch (err) {
      showToast('Ошибка изменения данных на сервере', 'error');
    }
  };
  // --- ДОБАВИТЬ ФУНКЦИИ В APP.JSX ---

  // Функция 1: Экспорт текущей таблицы в файл Excel
  const handleExportToExcel = () => {
    if (products.length === 0) {
      showToast('Нет данных для выгрузки', 'error');
      return;
    }

    // Формируем понятную человеку таблицу на русском языке
    const dataToExport = products.map(p => {
      const cat = categories.find(c => c.id === p.categoryId);
      return {
        'Наименование товара': p.name,
        'Внутренний код': p.internalCode,
        'Гос. код товара': p.govCode,
        'Категория': cat ? cat.name : 'Без категории',
        'Остаток (шт)': p.quantity,
        'Цена продажи (₸)': p.price,
        'Себестоимость (₸)': p.cost,
        'Ожидаемая прибыль (₸)': (p.price - p.cost) * p.quantity
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Складской учет');

    // Автоматическое скачивание файла в браузер
    const dateStr = new Date().toISOString().split('T')[0];
    XLSX.writeFile(workbook, `Otchet_Sklad_${dateStr}.xlsx`);
    showToast('Файл Excel успешно сгенерирован и скачан');
  };

  // Функция 2: Импорт множества товаров из файла Excel
  const handleImportFromExcel = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const binaryStr = evt.target.result;
        const workbook = XLSX.read(binaryStr, { type: 'binary' });
        
        // Берем самый первый лист из файла Excel
        const firstWorksheet = workbook.Sheets[workbook.SheetNames[0]];
        // Превращаем строки Excel в удобный массив объектов
        const rawRows = XLSX.utils.sheet_to_json(firstWorksheet);

        // Маппим русские названия колонок обратно в ключи нашей базы данных
        const formattedProducts = rawRows.map(row => {
          // Получаем имя категории из Excel
          const categoryName = String(row['Категория'] || row['category'] || "").trim();
          
          // Ищем ID существующей категории, имя которой совпадает с текстом из Excel
          const foundCategory = categories.find(c => c.name.trim() === categoryName);
          
          return {
            name: String(row['Наименование товара'] || row['name'] || row['Наименование'] || '').trim(),
            internalCode: String(row['Внутренний код'] || row['internalCode'] || '').trim(),
            govCode: String(row['Гос. код товара'] || row['govCode'] || row['Гос. код'] || '').trim(),
            quantity: Number(row['Остаток (шт)']) || Number(row['quantity']) || 0,
            price: Number(row['Цена продажи (₸)']) || Number(row['price']) || 0,
            cost: Number(row['Себестоимость (₸)']) || Number(row['cost']) || 0,
            // Если нашли категорию по имени — берем её ID, иначе пустая строка
            categoryId: foundCategory ? foundCategory.id : ""
          };
        }).filter(p => p.name); // Пропускаем пустые строки, если нет имени

        if (formattedProducts.length === 0) {
          showToast('В файле не найдено подходящих товаров', 'error');
          return;
        }

        // Отправляем массив на наш новый пакетный роут бэкенда
        const res = await fetch(`${API_URL}/products/batch`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': currentPassword
          },
          body: JSON.stringify(formattedProducts)
        });

        if (res.ok) {
          showToast(`Успешно импортировано ${formattedProducts.length} товаров из Excel!`);
          fetchData(); // Обновляем данные на экране
        } else {
          showToast('Ошибка сохранения пакета на сервере', 'error');
        }
      } catch (err) {
        showToast('Не удалось распознать структуру Excel файла', 'error');
      }
    };

    reader.readAsBinaryString(file);
    e.target.value = ''; // Сбрасываем значение инпута, чтобы можно было загрузить файл повторно
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
  // --- ДОБАВИТЬ В APP.JSX ---

// 1. Состояние для сканера
const [isScannerOpen, setIsScannerOpen] = useState(false);
const [scannedProduct, setScannedProduct] = useState(null);

// 2. Функция обработки списания (без маржинальности)
const handleQuantityChange = async (changeAmount) => {
  if (!scannedProduct) return;

  const newQuantity = scannedProduct.quantity + changeAmount;
  
  try {
    const res = await fetch(`${API_URL}/products/${scannedProduct.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': currentPassword },
      body: JSON.stringify({ field: 'quantity', value: newQuantity })
    });
    
    if (res.ok) {
      showToast(`Товар "${scannedProduct.name}" изменен на ${changeAmount}`);
      setIsScannerOpen(false);
      setScannedProduct(null);
      fetchData(); // Обновить таблицу
    }
  } catch (err) {
    showToast('Ошибка обновления', 'error');
  }
};

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

    const apiKey = ""; // Ключ подставляется автоматически вашей платформой
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
            <h2 className="text-2xl font-bold text-slate-900">Тайны Потока Складской учет</h2>
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
              <h1 className="text-xl font-bold text-slate-900 leading-tight">Тайны Потока Складской учет</h1>
              <p className="text-xs text-slate-500">Синхронизированная база данных</p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            {/* --- ДОБАВИТЬ В ВЕРСТКУ ШАПКИ (БЛОК КНОПОК) --- */}

            {/* Кнопка экспорта */}
            <button
              onClick={handleExportToExcel}
              className="px-4 py-2 text-sm font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors flex items-center gap-2"
            >
              📊 Экспорт Excel
            </button>

            {/* Скрытый нативный инпут и стилизованная под него кнопка импорта */}
            <label className="px-4 py-2 text-sm font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 cursor-pointer transition-colors flex items-center gap-2">
              📥 Импорт Excel
              <input 
                type="file" 
                accept=".xlsx, .xls, .csv" 
                onChange={handleImportFromExcel} 
                        className="hidden" 
            />
            </label>
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
              onClick={() => setIsScannerOpen(true)}
              className="px-4 py-2 text-sm font-semibold text-white bg-slate-800 rounded-lg hover:bg-slate-900 transition-colors flex items-center gap-2"
            >
              📷 Сканер
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
                  <th className="relative px-6 py-3.5"><span className="sr-only">QR</span></th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {sortedProducts.map((p) => {
                  const cat = categories.find(c => c.id === p.categoryId);
                  const { profit, marginPercent } = getProfitMetrics(p.price, p.cost);
                  return (
                    <tr key={p.id} className="hover:bg-slate-50 group">
                      <td className="px-6 py-4 whitespace-normal break-words min-w-[250px] max-w-[350px]">
                        <div className="font-semibold text-slate-900 leading-snug">{p.name}</div>
                      </td>
                      {/* Столбец Кодов с быстрым редактированием */}
<td className="px-6 py-4 whitespace-nowrap text-xs font-mono text-slate-500">
  <div className="flex flex-col gap-1.5">
    
    {/* 1. Редактирование Внутреннего кода */}
    {inlineEditState.productId === p.id && inlineEditState.field === 'internalCode' ? (
      <div className="flex items-center gap-1">
        <input 
          type="text" 
          value={inlineEditState.value} 
          onChange={(e) => setInlineEditState({ ...inlineEditState, value: e.target.value })} 
          className="w-28 border border-indigo-500 rounded p-1 text-xs" 
        />
        <button onClick={() => handleInlineSave(p.id, 'internalCode')} className="p-1 bg-emerald-500 text-white rounded text-[10px]">✓</button>
      </div>
    ) : (
      <div className="flex items-center space-x-1.5 group/code">
        <span className="font-semibold text-slate-600">{p.internalCode || 'Нет кода'}</span>
        <button 
          onClick={() => setInlineEditState({ productId: p.id, field: 'internalCode', value: String(p.internalCode || '') })} 
          className="text-slate-400 hover:text-indigo-600 opacity-0 group-hover/code:opacity-100 text-[10px]"
        >
          ✏️
        </button>
      </div>
    )}

    {/* 2. Редактирование Гос. кода */}
    {inlineEditState.productId === p.id && inlineEditState.field === 'govCode' ? (
      <div className="flex items-center gap-1">
        <input 
          type="text" 
          value={inlineEditState.value} 
          onChange={(e) => setInlineEditState({ ...inlineEditState, value: e.target.value })} 
          className="w-28 border border-indigo-500 rounded p-1 text-[10px]" 
        />
        <button onClick={() => handleInlineSave(p.id, 'govCode')} className="p-1 bg-emerald-500 text-white rounded text-[10px]">✓</button>
      </div>
    ) : (
      <div className="flex items-center space-x-1.5 group/gov">
        <span className="text-[10px] text-slate-400">{p.govCode || 'Нет гос. кода'}</span>
        <button 
          onClick={() => setInlineEditState({ productId: p.id, field: 'govCode', value: String(p.govCode || '') })} 
          className="text-slate-400 hover:text-indigo-600 opacity-0 group-hover/gov:opacity-100 text-[9px]"
        >
          ✏️
        </button>
      </div>
    )}

  </div>
</td>
                      
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
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      <button 
                        onClick={() => setSelectedProductForQR(p)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 transition-colors"
                        title="Показать QR"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h3m-3 0H9m-3 0h3m2 6h4m0 0h2m-2 0v2m0-2v-2m0 0h2m-2 0H8m-2 0H4m4-4h2m-2 0H8m0 0v2m0 0H6m2 0h2m0 0V8m0 0H8m0 0h2m-2 0H6m0 0v2m0 0H4m16 0h-2m-2 0h-2m2 0V8m0 0h2m-2 0h-2m0 0v2m0 0h2m-2 0H8m-2 0H4" />
                        </svg>
                      </button>
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
      {/* МОДАЛЬНОЕ ОКНО: Сканер */}
      {isScannerOpen && (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center">
          {!scannedProduct ? (
            <div className="relative w-full h-full flex flex-col items-center justify-center">
              <BarcodeScanner
                width={"100%"} // Растягиваем на всю ширину
                height={"100%"} // Растягиваем на всю высоту
                videoConstraints={{ facingMode: "environment" }} // Всегда задняя камера
                onUpdate={(err, result) => {
                  if (result) {
                    const scannedCode = result.text.trim();
                    setLastScanned(scannedCode);
                    
                    // Включаем логирование в консоль, чтобы видеть это в F12 на ПК
                    console.log("Сканер считал:", scannedCode);
                    console.log("Список товаров (первые 3):", products.slice(0, 3).map(p => p.govCode));

                    // Ищем товар с принудительным приведением всего к строке и нижнему регистру
                    const found = products.find(p => {
                      const dbCode = String(p.govCode || '').trim();
                      return dbCode.toLowerCase() === scannedCode.toLowerCase();
                    });

                    if (found) {
                      console.log("НАЙДЕН ТОВАР:", found.name);
                      setScannedProduct(found);
                    } else {
                      console.log("Товар не найден в массиве products");
                    }
                  }
                }}
              />
              <div className="absolute top-20 bg-black/70 text-white p-4 rounded-lg z-[101]">
                Считано: {lastScanned} | Статус: {scannedProduct ? "НАЙДЕНО!" : "Ищем..."}
              </div>
              <button onClick={() => setIsScannerOpen(false)} className="...">Закрыть сканер</button>
            </div>
    ) : (
        /* ЭКРАН 2: Интерфейс ввода количества */
        <div className="bg-white p-8 rounded-2xl w-full max-w-sm text-center z-[102]">
          <h2 className="text-xl font-bold mb-1">{scannedProduct.name}</h2>
          <p className="text-slate-500 mb-6">На складе: {scannedProduct.quantity} шт.</p>
          
          {/* Поле ввода */}
          <input 
            type="number"
            id="manualQuantity"
            placeholder="Введите количество"
            className="w-full p-4 border-2 border-slate-200 rounded-xl text-center text-lg font-bold mb-4 focus:border-indigo-500 focus:outline-none"
          />

          {/* Кнопки выбора действия */}
          <div className="grid grid-cols-2 gap-4">
            <button 
              onClick={() => {
                const val = parseInt(document.getElementById('manualQuantity').value) || 0;
                handleQuantityChange(-val); // Списание
              }}
              className="bg-rose-500 text-white p-4 rounded-xl font-bold hover:bg-rose-600"
            >
              Списать (-)
            </button>
            <button 
              onClick={() => {
                const val = parseInt(document.getElementById('manualQuantity').value) || 0;
                handleQuantityChange(val); // Приход
              }}
              className="bg-emerald-500 text-white p-4 rounded-xl font-bold hover:bg-emerald-600"
            >
              Приход (+)
            </button>
          </div>

          <button 
            onClick={() => { setScannedProduct(null); setLastScanned("..."); }} 
            className="mt-6 text-slate-400 text-sm"
          >
            Отмена и назад к сканеру
          </button>
        </div>
    )}
  </div>
)}
      {selectedProductForQR && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded-2xl shadow-xl text-center">
            <h3 className="font-bold text-lg mb-4">{selectedProductForQR.name}</h3>
            <div className="bg-white p-2 border rounded-lg">
              <QRCodeCanvas 
                value={selectedProductForQR.govCode} 
                size={200}
              />
            </div>
            <p className="mt-4 text-sm text-slate-500">Код: {selectedProductForQR.govCode}</p>
            <button 
              onClick={() => setSelectedProductForQR(null)}
              className="mt-6 w-full py-2 bg-slate-100 hover:bg-slate-200 rounded-lg font-semibold"
            >
              Закрыть
            </button>
          </div>
        </div>
      )}
    </div>
  );
}