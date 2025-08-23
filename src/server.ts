import express from 'express';
import { bot } from './bot';
import * as dotenv from 'dotenv';
import { OrderRepository } from './repositories/orderRepository';
import { getDistributors } from './abcp';

dotenv.config();

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

// GET /api/orders?telegramId=&since=ISO&page=1&pageSize=100
app.get('/bot-api/orders', requireApiKey, async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const telegramId = (req.query.telegramId as string) || '';
    const sinceStr = (req.query.since as string) || '';
    const page = Math.max(1, Number(req.query.page || 1));
    const pageSize = Math.min(1000, Math.max(1, Number(req.query.pageSize || 100)));
    const sinceDate = sinceStr ? new Date(sinceStr) : undefined;
    const since = sinceDate && !isNaN(sinceDate.getTime()) ? sinceDate : undefined;
   
    const rows = await OrderRepository.list({
      telegramId: telegramId || undefined,
      since,
      page,
      pageSize,
    });

    // Получим дистрибьюторов и преобразуем в map по id
    let distributorsMap: Record<string, any> = {};
    try {
      const distributors: any[] = await getDistributors();
      distributorsMap = Array.isArray(distributors)
        ? distributors.reduce((acc: Record<string, any>, d: any) => {
            const id = String(d?.id ?? d?.distributorId ?? '');
            if (id) {
              acc[id] = {
                id,
                name: d?.name,
                contractor: d?.contractor,
                updateTime: d?.updateTime,
              };
            }
            return acc;
          }, {})
        : {};
    } catch (e) {
      distributorsMap = {};
    }

    res.json({ page, pageSize, count: rows.length, orders: rows, distributorsMap });
    return;
  } catch (e: any) {
    console.error('GET /api/orders error:', e?.message || e);
    res.status(500).json({ error: 'internal_error' });
    return;
  }
});

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
