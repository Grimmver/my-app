import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { QRCodeCanvas } from 'qrcode.react';
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';

// Автоматическое определение адреса API:
// Локально используется http://localhost:3000/api, а на Render (и любом хостинге) — относительный путь /api
const API_URL =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:3000/api'
    : '/api';

// Настройки Cloudinary для загрузки фотографий товаров (Unsigned Upload)
// Считываются из переменных окружения CLOUDINARY_CLOUD_NAME и CLOUDINARY_UPLOAD_PRESET
const CLOUDINARY_CLOUD_NAME =
  import.meta.env.CLOUDINARY_CLOUD_NAME ||
  import.meta.env.VITE_CLOUDINARY_CLOUD_NAME ||
  "";
const CLOUDINARY_UPLOAD_PRESET =
  import.meta.env.CLOUDINARY_UPLOAD_PRESET ||
  import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET ||
  "";

// Вспомогательная функция для безопасного чтения массива ссылок на фото из БД
export function parseProductImages(imagesRaw) {
  if (!imagesRaw) return [];
  if (Array.isArray(imagesRaw)) {
    return imagesRaw.filter((url) => typeof url === 'string' && url.trim() !== '');
  }
  if (typeof imagesRaw === 'string') {
    const trimmed = imagesRaw.trim();
    if (!trimmed || trimmed === '[]') return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.filter((url) => typeof url === 'string' && url.trim() !== '');
      }
    } catch {
      // Если в поле записана одиночная ссылка строкой
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:')) {
        return [trimmed];
      }
    }
  }
  return [];
}

export default function App({ onSwitchToShop }) {
  // --- Состояния авторизации ---
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [userRole, setUserRole] = useState(localStorage.getItem('userRole') || '');

  // --- Основные данные склада ---
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [history, setHistory] = useState([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

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
  const [selectedProductDetails, setSelectedProductDetails] = useState(null);
  const [isEditingProduct, setIsEditingProduct] = useState(false);
  const [editFormData, setEditFormData] = useState({
    name: '',
    govCode: '',
    price: 0,
    description: '',
    images: []
  });

  // --- Состояния галереи фото и загрузки в Cloudinary внутри карточки товара ---
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [manualPhotoUrl, setManualPhotoUrl] = useState('');
  const [cloudinaryCloudName, setCloudinaryCloudName] = useState(
    () => CLOUDINARY_CLOUD_NAME || localStorage.getItem('cloudinary_cloud_name') || ''
  );
  const [cloudinaryUploadPreset, setCloudinaryUploadPreset] = useState(
    () => CLOUDINARY_UPLOAD_PRESET || localStorage.getItem('cloudinary_upload_preset') || ''
  );
  const [isCloudinarySettingsOpen, setIsCloudinarySettingsOpen] = useState(false);

  // --- Формы создания ---
  const [newProduct, setNewProduct] = useState({
    name: '',
    internalCode: '',
    govCode: '',
    quantity: 0,
    price: 0,
    cost: 0,
    categoryId: '',
    description: '',
    images: []
  });
  const [newCategoryName, setNewCategoryName] = useState('');

  // --- Быстрое инлайн-редактирование ---
  const [inlineEditState, setInlineEditState] = useState({
    productId: null,
    field: null,
    value: ''
  });

  // Загружаем данные сразу после успешного входа
  useEffect(() => {
    if (token) {
      fetchData(token);
    }
  }, [token]);

  // Сбрасываем индекс выбранного фото при открытии другой карточки товара
  useEffect(() => {
    setActivePhotoIndex(0);
    setManualPhotoUrl('');
  }, [selectedProductDetails?.id]);

  // Функция всплывающих уведомлений
  const showToast = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // Сохранение настроек Cloudinary в localStorage
  const handleSaveCloudinarySettings = () => {
    localStorage.setItem('cloudinary_cloud_name', cloudinaryCloudName.trim());
    localStorage.setItem('cloudinary_upload_preset', cloudinaryUploadPreset.trim());
    setIsCloudinarySettingsOpen(false);
    showToast('Настройки Cloudinary сохранены', 'success');
  };

  // Загрузка одного или нескольких фото в Cloudinary в черновик редактирования карточки
  // (запись в базу данных происходит только при нажатии кнопки «Сохранить изменения»)
  const handleUploadPhotosToCloudinary = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0 || !selectedProductDetails) return;

    const cloudName = cloudinaryCloudName.trim();
    const uploadPreset = cloudinaryUploadPreset.trim();

    if (!cloudName || !uploadPreset) {
      setIsCloudinarySettingsOpen(true);
      showToast(
        'Для загрузки в Cloudinary укажите Cloud Name и Upload Preset (Unsigned)',
        'error'
      );
      e.target.value = '';
      return;
    }

    setIsUploadingPhoto(true);
    try {
      const uploadedUrls = [];

      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', uploadPreset);

        const uploadRes = await fetch(
          `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
          {
            method: 'POST',
            body: formData
          }
        );

        const uploadData = await uploadRes.json();
        if (!uploadRes.ok || !uploadData.secure_url) {
          throw new Error(
            uploadData?.error?.message ||
              'Ошибка загрузки в Cloudinary. Проверьте Cloud Name и Unsigned Upload Preset.'
          );
        }

        uploadedUrls.push(uploadData.secure_url);
      }

      const currentImages = editFormData.images || [];
      const updatedImages = [...currentImages, ...uploadedUrls];

      // Обновляем только локальный черновик формы редактирования (без записи в БД до нажатия «Сохранить»)
      setEditFormData((prev) => ({
        ...prev,
        images: updatedImages
      }));

      // Переключаем предпросмотр на первое из только что загруженных фото
      setActivePhotoIndex(currentImages.length);
      showToast(
        uploadedUrls.length === 1
          ? 'Фото загружено! Нажмите «Сохранить изменения», чтобы записать в БД.'
          : `Загружено ${uploadedUrls.length} фото! Нажмите «Сохранить изменения», чтобы записать в БД.`,
        'success'
      );
    } catch (err) {
      showToast(err.message || 'Ошибка при загрузке фото в Cloudinary', 'error');
    } finally {
      setIsUploadingPhoto(false);
      e.target.value = '';
    }
  };

  // Добавление фото по прямой ссылке в черновик редактирования
  const handleAddPhotoByUrl = () => {
    const trimmedUrl = manualPhotoUrl.trim();
    if (!trimmedUrl || !selectedProductDetails) return;

    if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
      showToast('Введите корректную ссылку (начинающуюся с https://)', 'error');
      return;
    }

    const currentImages = editFormData.images || [];
    const updatedImages = [...currentImages, trimmedUrl];

    setEditFormData((prev) => ({
      ...prev,
      images: updatedImages
    }));
    setManualPhotoUrl('');
    setActivePhotoIndex(updatedImages.length - 1);
    showToast('Ссылка добавлена! Нажмите «Сохранить изменения», чтобы записать в БД.', 'success');
  };

  // Удаление фото из черновика редактирования карточки товара
  const handleRemovePhoto = (indexToRemove) => {
    if (!selectedProductDetails) return;
    const currentImages = editFormData.images || [];
    const updatedImages = currentImages.filter((_, idx) => idx !== indexToRemove);

    setEditFormData((prev) => ({
      ...prev,
      images: updatedImages
    }));
    setActivePhotoIndex((prev) =>
      updatedImages.length === 0 ? 0 : Math.min(prev, updatedImages.length - 1)
    );
  };

  // Сделать выбранное дополнительное фото основным в черновике редактирования
  const handleMakePrimaryPhoto = (indexToPromote) => {
    if (!selectedProductDetails || indexToPromote <= 0) return;
    const currentImages = editFormData.images || [];
    if (indexToPromote >= currentImages.length) return;

    const chosen = currentImages[indexToPromote];
    const rest = currentImages.filter((_, idx) => idx !== indexToPromote);
    const updatedImages = [chosen, ...rest];

    setEditFormData((prev) => ({
      ...prev,
      images: updatedImages
    }));
    setActivePhotoIndex(0);
  };

  // Метод получения всех данных с сервера
  const fetchData = async (currentToken = token) => {
    try {
      const res = await fetch(`${API_URL}/data`, {
        headers: { 'Authorization': `Bearer ${currentToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setProducts(data.products || []);
        setCategories(data.categories || []);
        if (data.cloudinary?.cloudName) {
          setCloudinaryCloudName(data.cloudinary.cloudName);
        }
        if (data.cloudinary?.uploadPreset) {
          setCloudinaryUploadPreset(data.cloudinary.uploadPreset);
        }
      } else if (res.status === 401 || res.status === 403) {
        handleLogout();
      }
    } catch (err) {
      showToast('Ошибка подключения к серверу базы данных', 'error');
    }
  };

  // Авторизация
  const handleLogin = async () => {
    if (!usernameInput || !passwordInput) {
      showToast('Введите логин и пароль', 'error');
      return;
    }

    try {
      const res = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: usernameInput.trim(), password: passwordInput })
      });
      
      const data = await res.json();
      
      if (res.ok) {
        setToken(data.token);
        setUserRole(data.role);
        localStorage.setItem('token', data.token);
        localStorage.setItem('userRole', data.role);
        
        showToast(`Добро пожаловать, ${data.username}!`, 'success');
        fetchData(data.token); 
      } else {
        showToast(data.error || 'Ошибка входа', 'error');
      }
    } catch (err) {
      showToast('Ошибка сети', 'error');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userRole');
    setToken('');
    setUserRole('');
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
      cost: Number(newProduct.cost) || 0,
      description: (newProduct.description || '').trim(),
      images: Array.isArray(newProduct.images) ? newProduct.images : []
    };

    try {
      const res = await fetch(`${API_URL}/products`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(finalProduct)
      });

      if (res.ok) {
        setIsAddProductOpen(false);
        setNewProduct({
          name: '',
          internalCode: '',
          govCode: '',
          quantity: 0,
          price: 0,
          cost: 0,
          categoryId: categories[0]?.id || '',
          description: '',
          images: []
        });
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
          'Authorization': `Bearer ${token}`
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

  // Экспорт текущей таблицы в Excel
  const handleExportToExcel = () => {
    if (products.length === 0) {
      showToast('Нет данных для выгрузки', 'error');
      return;
    }

    const dataToExport = products.map(p => {
      const cat = categories.find(c => c.id === p.categoryId);
      const baseObj = {
        'Наименование товара': p.name,
        'Внутренний код': p.internalCode,
        'Гос. код товара': p.govCode,
        'Категория': cat ? cat.name : 'Без категории',
        'Остаток (шт)': p.quantity,
        'Цена продажи (₸)': p.price,
      };
      
      if (userRole === 'owner') {
        baseObj['Себестоимость (₸)'] = p.cost;
        baseObj['Ожидаемая прибыль (₸)'] = (p.price - p.cost) * p.quantity;
        baseObj['Фактическая прибыль (₸)'] = p.realized_profit || 0;
      }
      return baseObj;
    });

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Складской учет');

    const dateStr = new Date().toISOString().split('T')[0];
    XLSX.writeFile(workbook, `Otchet_Sklad_${dateStr}.xlsx`);
    showToast('Файл Excel успешно сгенерирован и скачан');
  };

  // Импорт из Excel
  const handleImportFromExcel = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const binaryStr = evt.target.result;
        const workbook = XLSX.read(binaryStr, { type: 'binary' });
        const firstWorksheet = workbook.Sheets[workbook.SheetNames[0]];
        const rawRows = XLSX.utils.sheet_to_json(firstWorksheet);

        const formattedProducts = rawRows.map(row => {
          const categoryName = String(row['Категория'] || row['category'] || "").trim();
          const foundCategory = categories.find(c => c.name.trim() === categoryName);
          
          return {
            name: String(row['Наименование товара'] || row['name'] || row['Наименование'] || '').trim(),
            internalCode: String(row['Внутренний код'] || row['internalCode'] || '').trim(),
            govCode: String(row['Гос. код товара'] || row['govCode'] || row['Гос. код'] || '').trim(),
            quantity: Number(row['Остаток (шт)']) || Number(row['quantity']) || 0,
            price: Number(row['Цена продажи (₸)']) || Number(row['price']) || 0,
            cost: Number(row['Себестоимость (₸)']) || Number(row['cost']) || 0,
            categoryId: foundCategory ? foundCategory.id : ""
          };
        }).filter(p => p.name);

        if (formattedProducts.length === 0) {
          showToast('В файле не найдено подходящих товаров', 'error');
          return;
        }

        const res = await fetch(`${API_URL}/products/batch`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(formattedProducts)
        });

        if (res.ok) {
          showToast(`Успешно импортировано ${formattedProducts.length} товаров из Excel!`);
          fetchData(); 
        } else {
          showToast('Ошибка сохранения пакета на сервере', 'error');
        }
      } catch (err) {
        showToast('Не удалось распознать структуру Excel файла', 'error');
      }
    };

    reader.readAsBinaryString(file);
    e.target.value = ''; 
  };

  // Удаление товара из базы данных
  const handleDeleteProduct = async (prodId, name) => {
    if (confirm(`Вы действительно хотите удалить товар "${name}"?`)) {
      try {
        const res = await fetch(`${API_URL}/products/${prodId}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
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
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(newCategory)
      });
      if (res.ok) {
        setNewCategoryName('');
        showToast(`Категория "${newCategory.name}" создана`);
        fetchData();
      }
    } catch (err) {
      showToast('Ошибка при добавлении категории', 'error');
    }
  };

  const handleDeleteCategory = async (catId) => {
    try {
      const res = await fetch(`${API_URL}/categories/${catId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        showToast('Категория удалена', 'warning');
        fetchData(); 
      }
    } catch (err) {
      showToast('Ошибка удаления', 'error');
    }
  };

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortBy === key && sortOrder === 'asc') {
      direction = 'desc';
    }
    setSortBy(key);
    setSortOrder(direction);
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = 
      p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.internalCode?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.govCode?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description?.toLowerCase().includes(searchQuery.toLowerCase());
    
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

  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannedProduct, setScannedProduct] = useState(null);

  const handleQuantityChange = async (changeAmount) => {
    if (!scannedProduct) return;

    const newQuantity = scannedProduct.quantity + changeAmount;
    
    try {
      const res = await fetch(`${API_URL}/products/${scannedProduct.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ field: 'quantity', value: newQuantity })
      });
      
      if (res.ok) {
        showToast(`Товар "${scannedProduct.name}" изменен на ${changeAmount}`);
        setIsScannerOpen(false);
        setScannedProduct(null);
        fetchData(); 
      }
    } catch (err) {
      showToast('Ошибка обновления', 'error');
    }
  };

  const handleSellProduct = async (quantityToSell) => {
    try {
      const res = await fetch(`${API_URL}/products/${scannedProduct.id}/sell`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ quantityToSell })
      });
      if (res.ok) {
        showToast(`Успешно продано ${quantityToSell} шт.`, 'success');
        fetchData(); 
        setScannedProduct(null); 
        setLastScanned("...");
      } else {
        showToast('Ошибка при продаже', 'error');
      }
    } catch(err) {
      showToast('Ошибка сети', 'error');
    }
  };

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

  const handleAiAnalysis = async () => {
    setIsAiModalOpen(true);
    setIsAiLoading(true);
    setAiResponse('');

    const apiKey = ""; 
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

  const fieldTranslations = {
    name: 'Наименование',
    quantity: 'Количество',
    price: 'Цена продажи',
    cost: 'Себестоимость',
    categoryId: 'Категория',
    internalCode: 'Внутренний код',
    govCode: 'Гос. код',
    description: 'Описание',
    images: 'Фотографии'
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch(`${API_URL}/history`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
      }
    } catch (err) {
      showToast('Ошибка при загрузке истории', 'error');
    }
  };
  
  const formatHistoryValue = (field, value, isOld = false) => {
    if (field === 'description' || field === 'Описание') {
      const hasText = Boolean(value && String(value).trim() && value !== 'пусто');
      if (!hasText) return 'пустой текст';
      return isOld ? 'заполненный текст' : 'новое';
    }
    if (!value || value === 'пусто') return 'пусто';
    if (field === 'Категория' || field === 'categoryId') {
      const foundCategory = categories.find(c => c.id === value);
      return foundCategory ? foundCategory.name : value;
    }
    if (field === 'images' || field === 'Фотографии') {
      const imgs = parseProductImages(value);
      return imgs.length > 0 ? `${imgs.length} фото` : 'нет фото';
    }
    return value;
  };

  const handleExportHistory = async (limit = null) => {
    try {
      const url = limit ? `${API_URL}/history/export?limit=${limit}` : `${API_URL}/history/export`;
      
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        const data = await res.json();
        
        if (data.length === 0) {
          showToast('История пуста, нечего выгружать', 'info');
          return;
        }

        // Форматируем данные для красивого отображения в Excel
        const excelData = data.map(h => ({
          'Дата и время': new Date(h.created_at + 'Z').toLocaleString('ru-RU'),
          'Пользователь': h.user_name || 'owner',
          'Товар': h.product_name,
          'Измененный параметр': fieldTranslations[h.field] || h.field,
          'Старое значение': formatHistoryValue(h.field, h.old_value, true) || '',
          'Новое значение': formatHistoryValue(h.field, h.new_value, false) || ''
        }));

        // Создаем и скачиваем файл Excel
        const worksheet = XLSX.utils.json_to_sheet(excelData);
        
        worksheet['!cols'] = [
          { wch: 20 }, // Дата
          { wch: 15 }, // Пользователь
          { wch: 40 }, // Товар
          { wch: 20 }, // Параметр
          { wch: 15 }, // Старое
          { wch: 15 }  // Новое
        ];

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "История");
        
        const filename = limit ? `История_последние_${limit}.xlsx` : `История_вся.xlsx`;
        XLSX.writeFile(workbook, filename);
        
        showToast('Файл истории успешно скачан', 'success');
      } else {
        showToast('Ошибка при получении данных истории', 'error');
      }
    } catch (err) {
      showToast('Ошибка сети при выгрузке', 'error');
    }
  };

  // Список фото для открытой карточки товара
  const currentCardImages = selectedProductDetails
    ? isEditingProduct
      ? editFormData.images
      : parseProductImages(selectedProductDetails.images)
    : [];
  const safeActivePhotoIndex =
    currentCardImages.length > 0
      ? Math.min(activePhotoIndex, currentCardImages.length - 1)
      : 0;

  // ЭКРАН 1: Вход
  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
        <div className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-sm space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold text-slate-800">Вход в систему</h1>
            <p className="text-xs text-slate-500">Авторизуйтесь для доступа к складу</p>
          </div>
          {notification && (
            <div className={`p-3 rounded-xl border font-medium text-sm text-center ${notification.type === 'error' ? 'bg-red-50 text-red-800 border-red-200' : 'bg-emerald-50 text-emerald-800 border-emerald-200'}`}>
              {notification.message}
            </div>
          )}
          <div className="space-y-4">
            <input
              type="text"
              placeholder="Логин (например: owner)"
              value={usernameInput}
              onChange={(e) => setUsernameInput(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
            />
            <input
              type="password"
              placeholder="Пароль"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
            />
            <button
              onClick={handleLogin}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors shadow-md"
            >
              Войти
            </button>
            {onSwitchToShop && (
              <button
                type="button"
                onClick={onSwitchToShop}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition-colors text-xs"
              >
                🛍️ Перейти на витрину магазина
              </button>
            )}
          </div>
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
              <p className="text-xs text-slate-500">
                Роль: {userRole === 'owner' ? 'Владелец' : 'Продавец'}
              </p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            {onSwitchToShop && (
              <button
                onClick={onSwitchToShop}
                className="px-4 py-2 text-sm font-semibold text-sky-700 bg-sky-50 border border-sky-200 rounded-lg hover:bg-sky-100 transition-colors flex items-center gap-2"
              >
                🛍️ Витрина магазина
              </button>
            )}

            <button
              onClick={handleExportToExcel}
              className="px-4 py-2 text-sm font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors flex items-center gap-2"
            >
              📊 Экспорт Excel
            </button>

            {/* Скрываем от продавца */}
            {userRole === 'owner' && (
              <label className="px-4 py-2 text-sm font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 cursor-pointer transition-colors flex items-center gap-2">
                📥 Импорт Excel
                <input 
                  type="file" 
                  accept=".xlsx, .xls, .csv" 
                  onChange={handleImportFromExcel} 
                  className="hidden" 
                />
              </label>
            )}

            {/* Скрываем от продавца */}
            {userRole === 'owner' && (
              <button
                onClick={handleAiAnalysis}
                className="px-4 py-2 text-sm font-semibold text-fuchsia-700 bg-fuchsia-50 border border-fuchsia-200 rounded-lg hover:bg-fuchsia-100 focus:outline-none focus:ring-2 focus:ring-fuchsia-500 transition-colors flex items-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                AI-Аналитик
              </button>
            )}

            {/* Скрываем от продавца */}
            {userRole === 'owner' && (
              <button
                onClick={() => setIsManageCategoriesOpen(true)}
                className="px-4 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors flex items-center gap-2"
              >
                Категории ({categories.length})
              </button>
            )}

            {/* Скрываем от продавца */}
            {userRole === 'owner' && (
              <button
                onClick={() => setIsAddProductOpen(true)}
                className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-md transition-colors flex items-center gap-2"
              >
                Добавить товар
              </button>
            )}

            <button
              onClick={() => setIsScannerOpen(true)}
              className="px-4 py-2 text-sm font-semibold text-white bg-slate-800 rounded-lg hover:bg-slate-900 transition-colors flex items-center gap-2"
            >
              📷 Сканер
            </button>

            <button
              onClick={() => { fetchHistory(); setIsHistoryOpen(true); }}
              className="px-4 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-2"
            >
              📜 История
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
        <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 ${userRole === 'owner' ? 'lg:grid-cols-4' : 'lg:max-w-3xl lg:mx-auto w-full'}`}>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center space-x-4">
            <div className="p-3 rounded-xl bg-indigo-50 text-indigo-600"><strong>₸</strong></div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Общая стоимость склада</p>
              <p className="text-xl font-bold text-slate-900 mt-1">{stats.totalRetailValue.toLocaleString()} ₸</p>
              <p className="text-[10px] text-slate-400 mt-0.5">{stats.totalQty} шт. на балансе</p>
            </div>
          </div>

          {/* Скрываем от продавца */}
          {userRole === 'owner' && (
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center space-x-4">
              <div className="p-3 rounded-xl bg-emerald-50 text-emerald-600"><strong>▲</strong></div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Чистая прибыль</p>
                <p className="text-xl font-bold text-slate-900 mt-1">{stats.expectedProfit.toLocaleString()} ₸</p>
                <p className="text-[10px] text-emerald-600 font-medium mt-0.5">При полной продаже</p>
              </div>
            </div>
          )}

          {/* Скрываем от продавца */}
          {userRole === 'owner' && (
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center space-x-4">
              <div className="p-3 rounded-xl bg-amber-50 text-amber-600"><strong>%</strong></div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Средняя доходность</p>
                <p className="text-xl font-bold text-slate-900 mt-1">{stats.averageMargin}%</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Маржинальность склада</p>
              </div>
            </div>
          )}

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
            placeholder="Поиск по наименованию, описанию, внутреннему или гос. коду..."
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
                  
                  {/* Скрываем колонку Себестоимости от продавца */}
                  {userRole === 'owner' && (
                    <th onClick={() => requestSort('cost')} className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase cursor-pointer hover:bg-slate-100">Себестоимость {sortBy === 'cost' && (sortOrder === 'asc' ? '▲' : '▼')}</th>
                  )}
                  <th className="relative px-6 py-3.5"><span className="sr-only">Действия</span></th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {sortedProducts.map((p) => {
                  const cat = categories.find(c => c.id === p.categoryId);
                  return (
                    <tr key={p.id} className="hover:bg-slate-50 group">
                      <td className="px-6 py-4 whitespace-normal break-words min-w-[250px] max-w-[350px]">
                        <div 
                          onClick={() => setSelectedProductDetails(p)}
                          className="font-semibold text-indigo-600 hover:text-indigo-800 leading-snug cursor-pointer transition-colors w-fit border-b border-dashed border-indigo-300 hover:border-indigo-800"
                          title="Открыть карточку товара"
                        >
                          {p.name}
                        </div>
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
                              {userRole === 'owner' && (
                              <button 
                                onClick={() => setInlineEditState({ productId: p.id, field: 'internalCode', value: String(p.internalCode || '') })} 
                                className="text-slate-400 hover:text-indigo-600 opacity-0 group-hover/code:opacity-100 text-[10px]"
                              >
                                ✏️
                              </button>
                              )}
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
                              {userRole === 'owner' && (
                                <button 
                                  onClick={() => setInlineEditState({ productId: p.id, field: 'govCode', value: String(p.govCode || '') })} 
                                  className="text-slate-400 hover:text-indigo-600 opacity-0 group-hover/gov:opacity-100 text-[9px]"
                                >
                                  ✏️
                                </button>
                              )}
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
                            {userRole === 'owner' && (
                              <button onClick={() => setInlineEditState({ productId: p.id, field: 'categoryId', value: p.categoryId || '' })} className="text-slate-400 hover:text-indigo-600 opacity-0 group-hover:opacity-100 text-xs">✏️</button>
                            )}
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
                            {userRole === 'owner' && (
                              <button onClick={() => setInlineEditState({ productId: p.id, field: 'price', value: p.price.toString() })} className="text-slate-400 hover:text-indigo-600 opacity-0 group-hover:opacity-100 text-xs">✏️</button>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Скрываем ячейку Себестоимости от продавца */}
                      {userRole === 'owner' && (
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
                      )}

                      {/* Действия */}
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        {userRole === 'owner' && (
                          <button onClick={() => handleDeleteProduct(p.id, p.name)} className="text-rose-600 hover:text-rose-900 font-medium">Удалить</button>
                        )}
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
      {isAddProductOpen && userRole === 'owner' && (
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

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Описание товара</label>
                <textarea
                  rows={2}
                  placeholder="Краткое или подробное описание товара..."
                  value={newProduct.description}
                  onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none"
                />
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
      {isManageCategoriesOpen && userRole === 'owner' && (
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
      {isAiModalOpen && userRole === 'owner' && (
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

      {/* МОДАЛЬНОЕ ОКНО: История изменений */}
      {isHistoryOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex flex-col items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-2xl">
              <h2 className="text-xl font-bold text-slate-800">История изменений</h2>
              
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => handleExportHistory(100)} 
                  className="text-xs font-semibold px-3 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  📥 Скачать последние 100
                </button>
                <button 
                  onClick={() => handleExportHistory()} 
                  className="text-xs font-semibold px-3 py-1.5 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors"
                >
                  📥 Скачать всё
                </button>
                <button onClick={() => setIsHistoryOpen(false)} className="text-slate-400 hover:text-slate-600 ml-2">✖</button>
              </div>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              {history.length === 0 ? (
                <p className="text-slate-500 text-center">История пока пуста.</p>
              ) : (
                <div className="space-y-4">
                  {history.map((h) => {
                    const isDescriptionField = h.field === 'description' || h.field === 'Описание';
                    const hadOldDesc = Boolean(h.old_value && String(h.old_value).trim() && h.old_value !== 'пусто');
                    const hasNewDesc = Boolean(h.new_value && String(h.new_value).trim() && h.new_value !== 'пусто');

                    return (
                      <div key={h.id} className="text-sm bg-slate-50 p-3 rounded-lg border border-slate-100">
                        <div className="text-xs text-slate-400 mb-1 flex justify-between items-center">
                          <span>{new Date(h.created_at + 'Z').toLocaleString('ru-RU')}</span>
                          <span className="font-medium text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-md">
                            👤 {h.user_name || 'owner'}
                          </span>
                        </div>
                        {isDescriptionField ? (
                          <div>
                            <span className="font-semibold text-slate-800">{h.product_name}</span> — изменено{' '}
                            <span className="font-medium text-indigo-600">Описание</span>:{' '}
                            {!hadOldDesc && hasNewDesc ? (
                              <>
                                с <span className="bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded line-through">пустого текста</span> на{' '}
                                <span className="bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">новое</span>
                              </>
                            ) : hadOldDesc && !hasNewDesc ? (
                              <>
                                с <span className="bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded line-through">заполненного</span> на{' '}
                                <span className="bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded">пустой текст</span>
                              </>
                            ) : (
                              <span className="bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">
                                обновлено на новое
                              </span>
                            )}
                          </div>
                        ) : (
                          <div>
                            <span className="font-semibold text-slate-800">{h.product_name}</span> изменилось{' '}
                            <span className="font-medium text-indigo-600">
                              {fieldTranslations[h.field] || h.field}
                            </span>{' '}
                            с <span className="bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded line-through">{formatHistoryValue(h.field, h.old_value, true) || 'пусто'}</span> на <span className="bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">{formatHistoryValue(h.field, h.new_value, false) || 'пусто'}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* МОДАЛЬНОЕ ОКНО: Карточка товара */}
      {selectedProductDetails && (
        <div className="fixed inset-0 z-[60] bg-black/60 flex flex-col items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl max-h-[95vh] overflow-hidden flex flex-col relative animate-fade-in">
            
            {/* Шапка карточки */}
            <div className="p-6 bg-slate-50 border-b border-slate-100 flex justify-between items-start gap-3">
              <div>
                <h2 className="text-2xl font-bold text-slate-800 leading-tight">{selectedProductDetails.name}</h2>
                <div className="text-sm font-semibold text-slate-500 mt-2 flex flex-wrap items-center gap-2">
                  <span className="px-2.5 py-0.5 bg-slate-200 rounded-md text-xs">
                    {categories.find(c => c.id === selectedProductDetails.categoryId)?.name || 'Без категории'}
                  </span>
                  {currentCardImages.length > 0 && (
                    <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-md text-xs font-semibold flex items-center gap-1">
                      <span>🖼️</span>
                      <span>Фото в БД: {currentCardImages.length} шт.</span>
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {/* Кнопка включения режима редактирования для owner */}
                {userRole === 'owner' && (
                  <button 
                    onClick={() => {
                      const nextEdit = !isEditingProduct;
                      setIsEditingProduct(nextEdit);
                      if (nextEdit) {
                        setEditFormData({
                          name: selectedProductDetails.name || '',
                          govCode: selectedProductDetails.govCode || '',
                          price: selectedProductDetails.price || 0,
                          description: selectedProductDetails.description || '',
                          images: parseProductImages(selectedProductDetails.images)
                        });
                      }
                    }}
                    className={`p-2 border rounded-full transition-colors shadow-sm text-sm ${
                      isEditingProduct
                        ? 'bg-amber-500 border-amber-600 text-white'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-amber-50 hover:border-amber-300'
                    }`}
                    title="Редактировать товар (описание, фото, цену, код)"
                  >
                    ✏️
                  </button>
                )}
                {/* Кнопка закрытия */}
                <button 
                  onClick={() => {
                    setSelectedProductDetails(null);
                    setIsEditingProduct(false);
                  }} 
                  className="p-2 bg-white border border-slate-200 text-slate-500 rounded-full hover:bg-slate-100 hover:text-slate-800 transition-colors shadow-sm"
                >
                  ✖
                </button>
              </div>
            </div>
            
            {/* Тело карточки */}
            <div className="p-6 space-y-6 overflow-y-auto flex-1">
              {/* БЛОК ФОТОГРАФИЙ ТОВАРА (основное фото + дополнительные фото в меньшем формате рядом) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                    Фотографии товара
                  </h3>
                  {currentCardImages.length > 0 && (
                    isEditingProduct ? (
                      <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">
                        Предпросмотр ({safeActivePhotoIndex + 1} из {currentCardImages.length}) — нажмите «Сохранить»
                      </span>
                    ) : (
                      <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                        ✓ Сохранено в БД ({safeActivePhotoIndex + 1} из {currentCardImages.length})
                      </span>
                    )
                  )}
                </div>

                {currentCardImages.length > 0 ? (
                  <div className="flex flex-col sm:flex-row gap-3 items-stretch">
                    {/* Основное (выбранное) фото */}
                    <div className="relative flex-1 h-64 sm:h-72 rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 flex items-center justify-center group">
                      <img
                        src={currentCardImages[safeActivePhotoIndex]}
                        alt={`${selectedProductDetails.name} — фото ${safeActivePhotoIndex + 1}`}
                        className="w-full h-full object-contain bg-white"
                      />

                      {safeActivePhotoIndex === 0 && (
                        <span className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-black/65 text-white text-[11px] font-semibold backdrop-blur-xs">
                          Основное фото
                        </span>
                      )}

                      {userRole === 'owner' && isEditingProduct && (
                        <div className="absolute top-3 right-3 flex items-center gap-1.5">
                          {safeActivePhotoIndex > 0 && (
                            <button
                              type="button"
                              onClick={() => handleMakePrimaryPhoto(safeActivePhotoIndex)}
                              className="px-2.5 py-1 rounded-lg bg-indigo-600/90 hover:bg-indigo-700 text-white text-[11px] font-semibold shadow-sm transition-colors"
                              title="Сделать это фото основным"
                            >
                              ★ Сделать основным
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleRemovePhoto(safeActivePhotoIndex)}
                            className="w-7 h-7 rounded-lg bg-rose-600/90 hover:bg-rose-700 text-white text-xs font-bold flex items-center justify-center shadow-sm transition-colors"
                            title="Удалить это фото"
                          >
                            ✕
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Дополнительные фотографии в меньшем формате рядом с основным фото */}
                    {currentCardImages.length > 1 && (
                      <div className="flex sm:flex-col gap-2 overflow-x-auto sm:overflow-y-auto sm:w-24 sm:max-h-72 shrink-0 pr-0.5">
                        {currentCardImages.map((imgUrl, idx) => {
                          const isSelected = idx === safeActivePhotoIndex;
                          return (
                            <div
                              key={`${imgUrl}-${idx}`}
                              onClick={() => setActivePhotoIndex(idx)}
                              className={`relative w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden border-2 cursor-pointer transition-all shrink-0 bg-white ${
                                isSelected
                                  ? 'border-indigo-600 ring-2 ring-indigo-200 scale-[1.02]'
                                  : 'border-slate-200 opacity-75 hover:opacity-100 hover:border-slate-300'
                              }`}
                              title={`Фото ${idx + 1}${idx === 0 ? ' (Основное)' : ''}`}
                            >
                              <img
                                src={imgUrl}
                                alt={`Миниатюра ${idx + 1}`}
                                className="w-full h-full object-cover"
                              />
                              <span className="absolute bottom-1 left-1 bg-black/60 text-white text-[9px] font-bold px-1 rounded">
                                {idx + 1}
                              </span>
                              {userRole === 'owner' && isEditingProduct && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemovePhoto(idx);
                                  }}
                                  className="absolute top-1 right-1 w-4 h-4 rounded-full bg-rose-600 text-white text-[9px] flex items-center justify-center opacity-85 hover:opacity-100"
                                  title="Удалить фото"
                                >
                                  ✕
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center space-y-2">
                    <div className="text-3xl text-slate-300">📷</div>
                    <p className="text-xs font-medium text-slate-500">
                      У этого товара пока нет загруженных фотографий
                    </p>
                    {userRole === 'owner' && !isEditingProduct && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsEditingProduct(true);
                          setEditFormData({
                            name: selectedProductDetails.name || '',
                            govCode: selectedProductDetails.govCode || '',
                            price: selectedProductDetails.price || 0,
                            description: selectedProductDetails.description || '',
                            images: parseProductImages(selectedProductDetails.images)
                          });
                        }}
                        className="mt-1 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-600 text-xs font-semibold transition-colors"
                      >
                        <span>✏️ Открыть редактирование (добавить фото и описание)</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* БЛОК ОПИСАНИЯ ТОВАРА (в режиме просмотра) */}
              {!isEditingProduct && (
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                      Описание товара
                    </h3>
                    {userRole === 'owner' && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsEditingProduct(true);
                          setEditFormData({
                            name: selectedProductDetails.name || '',
                            govCode: selectedProductDetails.govCode || '',
                            price: selectedProductDetails.price || 0,
                            description: selectedProductDetails.description || '',
                            images: parseProductImages(selectedProductDetails.images)
                          });
                        }}
                        className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                      >
                        ✏️ Изменить
                      </button>
                    )}
                  </div>
                  {selectedProductDetails.description && selectedProductDetails.description.trim() ? (
                    <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                      {selectedProductDetails.description}
                    </p>
                  ) : (
                    <p className="text-xs text-slate-400 italic">
                      Описание товара пока не добавлено. Нажмите «Изменить» (✏️), чтобы добавить описание.
                    </p>
                  )}
                </div>
              )}

              {/* БЛОК РЕДАКТИРОВАНИЯ (показывается при нажатии на карандаш ✏️) */}
              {isEditingProduct && userRole === 'owner' && (
                <div className="bg-amber-50/70 p-5 rounded-2xl border border-amber-200 space-y-4 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-amber-700 uppercase tracking-widest">
                      Редактирование карточки товара
                    </h3>
                    <button
                      type="button"
                      onClick={() => setIsCloudinarySettingsOpen(!isCloudinarySettingsOpen)}
                      className="text-xs font-semibold text-amber-700 hover:underline flex items-center gap-1"
                    >
                      <span>⚙️ Настройки Cloudinary</span>
                    </button>
                  </div>

                  {/* Настройки Cloudinary внутри редакции карточки */}
                  {isCloudinarySettingsOpen && (
                    <div className="bg-white p-3.5 rounded-xl border border-amber-300 space-y-2.5 text-xs">
                      <div className="font-bold text-slate-700">
                        Настройки Cloudinary (для загрузки фотографий в облако)
                      </div>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        Укажите ваш <strong>Cloud Name</strong> и имя <strong>Upload Preset</strong> с режимом <em>Unsigned</em> (Settings → Upload → Upload presets в панели Cloudinary).
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                            Cloud Name
                          </label>
                          <input
                            type="text"
                            placeholder="например: dxyz12345"
                            value={cloudinaryCloudName}
                            onChange={(e) => setCloudinaryCloudName(e.target.value)}
                            className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                            Upload Preset (Unsigned)
                          </label>
                          <input
                            type="text"
                            placeholder="например: unsigned_preset"
                            value={cloudinaryUploadPreset}
                            onChange={(e) => setCloudinaryUploadPreset(e.target.value)}
                            className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={handleSaveCloudinarySettings}
                          className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-lg"
                        >
                          Сохранить настройки Cloudinary
                        </button>
                      </div>
                    </div>
                  )}
                  
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Наименование</label>
                    <input 
                      type="text" 
                      value={editFormData.name} 
                      onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-amber-300 rounded-xl font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Гос. штрих-код</label>
                      <input 
                        type="text" 
                        value={editFormData.govCode} 
                        onChange={(e) => setEditFormData({ ...editFormData, govCode: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-amber-300 rounded-xl text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Цена продажи (₸)</label>
                      <input 
                        type="number" 
                        value={editFormData.price} 
                        onChange={(e) => setEditFormData({ ...editFormData, price: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-amber-300 rounded-xl text-slate-800 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                  </div>

                  {/* Редактирование описания товара */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">
                      Описание товара
                    </label>
                    <textarea
                      rows={4}
                      placeholder="Введите подробное описание товара, состав, размеры или особенности..."
                      value={editFormData.description}
                      onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-amber-300 rounded-xl text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 resize-y"
                    />
                  </div>

                  {/* Загрузка фотографий в Cloudinary прямо в редакции карточки */}
                  <div className="space-y-2.5 pt-1 border-t border-amber-200/80">
                    <label className="block text-xs font-semibold text-slate-500">
                      Фотографии товара (сохраняются в Cloudinary, а ссылки — в БД)
                    </label>

                    <div className="flex flex-col sm:flex-row gap-2">
                      <label
                        className={`flex-1 py-2.5 px-4 rounded-xl border-2 border-dashed text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors ${
                          isUploadingPhoto
                            ? 'bg-slate-100 border-slate-300 text-slate-400 cursor-wait'
                            : 'bg-white border-amber-400 text-amber-800 hover:bg-amber-100/60'
                        }`}
                      >
                        <span>
                          {isUploadingPhoto
                            ? '⏳ Загрузка фото в Cloudinary...'
                            : '☁️ Выбрать и загрузить фото (можно несколько)'}
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          disabled={isUploadingPhoto}
                          onChange={handleUploadPhotosToCloudinary}
                          className="hidden"
                        />
                      </label>
                    </div>

                    {/* Дополнительная возможность вставить готовую ссылку на фото */}
                    <div className="flex gap-2">
                      <input
                        type="url"
                        placeholder="Или вставьте готовую ссылку на фото (https://...)"
                        value={manualPhotoUrl}
                        onChange={(e) => setManualPhotoUrl(e.target.value)}
                        className="flex-1 px-3 py-1.5 bg-white border border-amber-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                      <button
                        type="button"
                        onClick={handleAddPhotoByUrl}
                        className="px-3 py-1.5 bg-white border border-amber-400 hover:bg-amber-100 text-amber-800 font-semibold rounded-xl text-xs transition-colors shrink-0"
                      >
                        + Добавить ссылку
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={async () => {
                        if (!editFormData.name.trim()) {
                          showToast('Название не может быть пустым', 'error');
                          return;
                        }

                        try {
                          const serializedImages = JSON.stringify(editFormData.images || []);
                          // Отправляем каждое измененное поле в формате, который ожидает сервер { field, value }
                          const updates = [
                            { field: 'name', value: editFormData.name.trim() },
                            { field: 'govCode', value: editFormData.govCode.trim() },
                            { field: 'price', value: Number(editFormData.price) },
                            { field: 'description', value: (editFormData.description || '').trim() },
                            { field: 'images', value: serializedImages }
                          ];

                          for (const update of updates) {
                            const res = await fetch(`${API_URL}/products/${selectedProductDetails.id}`, {
                              method: 'PUT',
                              headers: { 
                                'Content-Type': 'application/json', 
                                'Authorization': `Bearer ${token}` 
                              },
                              body: JSON.stringify(update)
                            });

                            if (!res.ok) throw new Error('Ошибка сохранения');
                          }

                          showToast('Товар, описание и фото успешно сохранены в БД', 'success');
                          
                          // Обновляем состояние открытой карточки с правильными ключами Turso
                          setSelectedProductDetails({ 
                            ...selectedProductDetails, 
                            name: editFormData.name.trim(),
                            govCode: editFormData.govCode.trim(),
                            price: Number(editFormData.price),
                            description: (editFormData.description || '').trim(),
                            images: serializedImages
                          });
                          setIsEditingProduct(false);
                          fetchData(); 
                        } catch (err) {
                          showToast('Ошибка сети при сохранении', 'error');
                        }
                      }}
                      className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl shadow-md transition-colors text-sm"
                    >
                      Сохранить изменения
                    </button>
                    <button
                      onClick={() => setIsEditingProduct(false)}
                      className="px-4 py-2.5 bg-slate-200 text-slate-600 font-semibold rounded-xl text-sm hover:bg-slate-300 transition-colors"
                    >
                      Отмена
                    </button>
                  </div>
                </div>
              )}

              {/* Блок: Остаток и Цена */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100 flex flex-col justify-center items-center text-center">
                  <div className="text-[10px] text-indigo-500 font-bold uppercase tracking-wider mb-1">Остаток на складе</div>
                  <div className="text-3xl font-black text-indigo-900">{selectedProductDetails.quantity} <span className="text-lg font-medium text-indigo-600">шт.</span></div>
                </div>
                <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 flex flex-col justify-center items-center text-center">
                  <div className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider mb-1">Цена продажи</div>
                  <div className="text-2xl font-black text-emerald-900">{selectedProductDetails.price.toLocaleString()} <span className="text-lg font-medium text-emerald-700">₸</span></div>
                </div>
              </div>

              {/* Блок: Статистика продаж */}
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Статистика продаж</h3>
                <div className="grid grid-cols-2 gap-y-5 gap-x-4">
                  <div>
                    <div className="text-xs text-slate-500 mb-0.5">Уже продано</div>
                    <div className="text-xl font-bold text-slate-800">{selectedProductDetails.sold_quantity || 0} шт.</div>
                  </div>
                  {/* Скрываем финансовую информацию от продавца */}
                  {userRole === 'owner' && (
                    <>
                      <div>
                        <div className="text-xs text-slate-500 mb-0.5">Чистая прибыль (Факт)</div>
                        <div className="text-xl font-bold text-emerald-600">+{(selectedProductDetails.realized_profit || 0).toLocaleString()} ₸</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500 mb-0.5">Маржинальность</div>
                        <div className="text-sm font-semibold text-indigo-600 bg-indigo-100/50 px-2 py-0.5 rounded inline-block">
                          {getProfitMetrics(selectedProductDetails.price, selectedProductDetails.cost).marginPercent}%
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500 mb-0.5">Потенциал (с остатка)</div>
                        <div className="text-sm font-semibold text-slate-600">
                          {(selectedProductDetails.quantity * (selectedProductDetails.price - selectedProductDetails.cost)).toLocaleString()} ₸
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Блок прямой продажи из карточки */}
              <div className="bg-indigo-50/50 p-5 rounded-2xl border border-indigo-100 space-y-3">
                <h3 className="text-xs font-bold text-indigo-600 uppercase tracking-widest">Быстрая продажа</h3>
                <div className="flex items-center gap-3">
                  <input 
                    type="number" 
                    id={`sell-input-${selectedProductDetails.id}`} 
                    defaultValue="1" 
                    min="1"
                    className="w-24 px-3 py-2.5 bg-white border border-indigo-200 rounded-xl text-center font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    onClick={async () => {
                      const inputEl = document.getElementById(`sell-input-${selectedProductDetails.id}`);
                      const qtyToSell = parseInt(inputEl.value) || 0;
                      
                      if (qtyToSell <= 0) {
                        showToast('Введите корректное количество', 'error');
                        return;
                      }

                      if (qtyToSell > selectedProductDetails.quantity) {
                        showToast('На складе нет столько товара!', 'error');
                        return;
                      }

                      // Вызываем функцию продажи
                      try {
                        const res = await fetch(`${API_URL}/products/${selectedProductDetails.id}/sell`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                          body: JSON.stringify({ quantityToSell: qtyToSell })
                        });
                        
                        if (res.ok) {
                          showToast(`Успешно продано ${qtyToSell} шт.`, 'success');
                          fetchData(); // Обновляем данные
                          setSelectedProductDetails(null); // Закрываем карточку
                        } else {
                          showToast('Ошибка при продаже', 'error');
                        }
                      } catch (err) {
                        showToast('Ошибка сети', 'error');
                      }
                    }}
                    className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md transition-colors text-sm flex items-center justify-center gap-2"
                  >
                    <span>💳 Продать со склада</span>
                  </button>
                </div>
              </div>

              {/* Блок: Коды и кнопка QR */}
              <div className="flex justify-between items-center bg-slate-50 px-5 py-4 rounded-2xl border border-slate-200">
                <div>
                  <div className="text-xs text-slate-400 font-mono"><span className="text-slate-500 font-semibold">ВНУТ:</span> {selectedProductDetails.internalCode || '—'}</div>
                  <div className="text-xs text-slate-400 font-mono mt-1"><span className="text-slate-500 font-semibold">ГОС:</span> {selectedProductDetails.govCode || '—'}</div>
                </div>
                <button 
                  onClick={() => {
                    const prod = selectedProductDetails;
                    setSelectedProductDetails(null); 
                    setSelectedProductForQR(prod); 
                  }}
                  className="flex items-center gap-2 bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-xl text-sm font-bold hover:bg-slate-100 hover:border-slate-400 transition-all shadow-sm"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h3m-3 0H9m-3 0h3m2 6h4m0 0h2m-2 0v2m0-2v-2m0 0h2m-2 0H8m-2 0H4m4-4h2m-2 0H8m0 0v2m0 0H6m2 0h2m0 0V8m0 0H8m0 0h2m-2 0H6m0 0v2m0 0H4m16 0h-2m-2 0h-2m2 0V8m0 0h2m-2 0h-2m0 0v2m0 0h2m-2 0H8m-2 0H4" />
                  </svg>
                  Штрих-код
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* МОДАЛЬНОЕ ОКНО: Нативный сканер */}
      {isScannerOpen && (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center">
          {!scannedProduct ? (
            <div className="relative w-full h-full flex flex-col items-center justify-center bg-black">
              {/* Кнопка запуска сканирования через Capacitor MLKit */}
              <div className="text-center p-6 space-y-4">
                <div className="text-white text-lg font-bold">Наведите камеру на штрих-код</div>
                <button 
                  onClick={async () => {
                    const status = await BarcodeScanner.requestPermissions();
                    if (status.camera !== 'granted') {
                      showToast('Нет доступа к камере', 'error');
                      return;
                    }
                    
                    document.querySelector('body').classList.add('scanner-active');
                    
                    try {
                      const result = await BarcodeScanner.scan();
                      document.querySelector('body').classList.remove('scanner-active');
                      
                      if (result.barcodes && result.barcodes.length > 0) {
                        const scannedCode = result.barcodes[0].displayValue.trim();
                        setLastScanned(scannedCode);

                        const found = products.find(p => {
                          const dbCode = String(p.govCode || '').trim();
                          return dbCode.toLowerCase() === scannedCode.toLowerCase();
                        });

                        if (found) {
                          setScannedProduct(found);
                        } else {
                          showToast(`Товар с кодом "${scannedCode}" не найден`, 'error');
                        }
                      }
                    } catch (e) {
                      document.querySelector('body').classList.remove('scanner-active');
                      setIsScannerOpen(false);
                    }
                  }}
                  className="px-8 py-4 bg-indigo-600 text-white font-bold rounded-2xl shadow-lg hover:bg-indigo-700 transition-all text-lg"
                >
                  Включить камеру
                </button>
              </div>

              <button 
                onClick={() => setIsScannerOpen(false)} 
                className="absolute bottom-10 px-8 py-3 bg-white/20 text-white rounded-full font-bold backdrop-blur-md"
              >
                Закрыть сканер
              </button>
            </div>
          ) : (
            /* Экран ввода количества после успешного сканирования */
            <div className="bg-white p-8 rounded-2xl w-full max-w-sm text-center z-[102]">
              <h2 className="text-xl font-bold mb-1">{scannedProduct.name}</h2>
              <p className="text-slate-500 mb-6">На складе: {scannedProduct.quantity} шт.</p>
              
              <input 
                type="number"
                id="manualQuantity"
                placeholder="Введите количество"
                defaultValue="1"
                className="w-full p-4 border-2 border-slate-200 rounded-xl text-center text-lg font-bold mb-4 focus:border-indigo-500 focus:outline-none"
              />

              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => {
                    const val = Math.abs(parseInt(document.getElementById('manualQuantity').value) || 0);
                    if (val > 0) handleSellProduct(val);
                  }}
                  className="bg-rose-500 text-white p-4 rounded-xl font-bold hover:bg-rose-600"
                >
                  Списать (-)
                </button>
                <button 
                  onClick={() => {
                    const val = parseInt(document.getElementById('manualQuantity').value) || 0;
                    if (val > 0) handleQuantityChange(val);
                  }}
                  className="bg-emerald-500 text-white p-4 rounded-xl font-bold hover:bg-emerald-600"
                >
                  Приход (+)
                </button>
              </div>

              <button 
                onClick={() => { setScannedProduct(null); setLastScanned("..."); }} 
                className="mt-6 text-slate-400 text-sm font-medium hover:text-slate-600"
              >
                Отмена и назад
              </button>
            </div>
          )}
        </div>
      )}

      {/* МОДАЛЬНОЕ ОКНО: Штрих-код */}
      {selectedProductForQR && (
        <div className="fixed inset-0 z-[70] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white p-8 rounded-3xl shadow-2xl text-center max-w-sm w-full relative animate-fade-in">
            <button 
              onClick={() => setSelectedProductForQR(null)} 
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-full transition-colors"
            >
              ✕
            </button>
            <h3 className="font-bold text-xl text-slate-800 mb-6 px-4">{selectedProductForQR.name}</h3>
            <div className="bg-white p-4 border-2 border-slate-100 rounded-2xl mx-auto w-fit inline-block shadow-sm">
              <QRCodeCanvas 
                value={selectedProductForQR.govCode || 'NO_CODE'} 
                size={220}
              />
            </div>
            <p className="mt-6 text-sm font-medium text-slate-500 tracking-wide font-mono bg-slate-50 py-2 px-4 rounded-lg inline-block">
              {selectedProductForQR.govCode || 'Код не задан'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
