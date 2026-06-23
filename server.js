import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Раздача статических файлов React-приложения
app.use(express.static(path.join(__dirname, 'dist')));

// Любой неизвестный роут направляем на фронтенд (важно для React)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// На Render порт задается через переменные окружения, нужно поменять фиксированный 3000
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Сервер запущен на порту ${PORT}`));