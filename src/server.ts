import express from 'express';
import { bot } from './bot';
import * as dotenv from 'dotenv';
import { db } from './db';
import { order } from './models';
import { and, eq, gte } from 'drizzle-orm';

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

// Формируем полный URL для webhook
const fullWebhookUrl = WEBHOOK_URL + WEBHOOK_PATH;
console.log('Полный webhook URL:', fullWebhookUrl);

// Устанавливаем webhook (один раз)
bot.telegram.setWebhook(fullWebhookUrl)
  .then(() => {
    console.log('>> Webhook установлен:', fullWebhookUrl);
  })
  .catch((err) => {
    console.error('Ошибка установки webhook:', err);
  });

app.use(express.json());

// Регистрируем webhook callback для указанного пути
app.use(WEBHOOK_PATH, bot.webhookCallback(WEBHOOK_PATH));

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
    const offset = (page - 1) * pageSize;

    const conditions: any[] = [];
    if (telegramId) conditions.push(eq(order.telegram_id, telegramId));
    if (sinceStr) {
      const sinceDate = new Date(sinceStr);
      if (!isNaN(sinceDate.getTime())) conditions.push(gte(order.datetime, sinceDate));
    }

    const whereClause = conditions.length ? and(...conditions) : undefined;
    const rows = await db
      .select()
      .from(order)
      .where(whereClause as any)
      .limit(pageSize)
      .offset(offset);

    res.json({ page, pageSize, count: rows.length, orders: rows });
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
