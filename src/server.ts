import express from 'express';
import { bot } from './bot';
import { loadEnv } from './config/env';
import { registerBotApiRoutes } from './web/botApiRoutes';

loadEnv();

const app = express();

// Получаем настройки из переменных окружения
const PORT = process.env.PORT || 8804;
const WEBHOOK_PATH = process.env.WEBHOOK_PATH || '/abcp-dev';
const WEBHOOK_URL = process.env.WEBHOOK_URL;

console.log('=== Конфигурация сервера ===');
console.log('PORT:', PORT);
console.log('WEBHOOK_PATH:', WEBHOOK_PATH);
console.log('WEBHOOK_URL:', WEBHOOK_URL);
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('===========================');

if (!process.env.BOT_TOKEN || !WEBHOOK_URL) {
  throw new Error('Необходимо указать BOT_TOKEN и WEBHOOK_URL в .env');
}

// Формируем полный URL для webhook безопасно (учитывая слэши)
const fullWebhookUrl = new URL(WEBHOOK_PATH, WEBHOOK_URL).toString();
console.log('Полный webhook URL:', fullWebhookUrl);

// Устанавливаем webhook (один раз)
bot.telegram.setWebhook(fullWebhookUrl, { drop_pending_updates: true })
  .then(() => {
    console.log('>> Webhook установлен:', fullWebhookUrl);
    // Логируем текущее состояние вебхука у Telegram
    bot.telegram.getWebhookInfo()
      .then((info) => {
        console.log('WebhookInfo:', info);
      })
      .catch((err) => {
        console.error('Ошибка getWebhookInfo:', err);
      });
    // Опционально: отправим тестовую /start в чат для проверки (если указан TEST_CHAT_ID)
    const testChatId = process.env.TEST_CHAT_ID;
    if (testChatId) {
      bot.telegram.sendMessage(testChatId, '/start')
        .then(() => console.log('Тестовая /start отправлена в', testChatId))
        .catch((err) => console.error('Не удалось отправить тестовую /start:', err));
    }
  })
  .catch((err) => {
    console.error('Ошибка установки webhook:', err);
  });

app.use(express.json());

// Простой GET-пинг того же пути — помогает проверить маршрутизацию и прокси
app.get(WEBHOOK_PATH, (req, res) => {
  res.status(200).send('webhook ok');
});

// Регистрируем webhook callback для указанного пути (POST от Telegram)
app.post(WEBHOOK_PATH, bot.webhookCallback(WEBHOOK_PATH));

// Простая защита API по ключу (опционально)
function requireApiKey(req: express.Request, res: express.Response, next: express.NextFunction): void {
  const requiredKey = process.env.API_KEY;
  if (!requiredKey) { next(); return; }
  const provided = req.header('x-api-key') || '';
  if (provided !== requiredKey) { res.status(401).json({ error: 'unauthorized' }); return; }
  next();
}

// Допустимые статусы (только англ коды)
const ALLOWED_STATUS: Array<'new' | 'in_progress' | 'rejected' | 'completed' | 'reserved'> = [
  'new', 'in_progress', 'rejected', 'completed', 'reserved'
];
function normalizeStatus(input: string): 'new' | 'in_progress' | 'rejected' | 'completed' | 'reserved' | null {
  const key = String(input || '').trim().toLowerCase();
  return (ALLOWED_STATUS as readonly string[]).includes(key) ? (key as any) : null;
}

// Регистрируем bot-api маршруты из отдельного модуля
registerBotApiRoutes(app);

// Добавляем health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    port: PORT, 
    webhookPath: WEBHOOK_PATH, 
    environment: process.env.NODE_ENV 
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
  console.log(`📡 Webhook путь: ${WEBHOOK_PATH}`);
  console.log(`🌍 Окружение: ${process.env.NODE_ENV || 'development'}`);
});
