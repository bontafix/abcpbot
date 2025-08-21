import express from 'express';
import { bot } from './bot';
import * as dotenv from 'dotenv';

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
