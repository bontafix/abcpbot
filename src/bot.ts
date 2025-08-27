import { Telegraf, session, Scenes } from 'telegraf';
import type { SessionStore } from 'telegraf';
import Redis from 'ioredis';
// import { db } from './db';
// import { user, service } from './models';
// import axios from 'axios';
import { message } from 'telegraf/filters';
import { getMainMenuGuest, getMainMenuUser, getProfileMenu } from './menu';
import { ClientRepository } from './repositories/clientRepository';
import { UserRepository } from './repositories/userRepository';
import searchWizard from './scenes/searchScene';
import orderScene from './scenes/orderScene';
import registrationScene from './scenes/registrationScene';
import profileScene from './scenes/profileScene';
import ordersScene from './scenes/ordersScene';
import ordersSummaryScene from './scenes/ordersSummaryScene';
import infoScene from './scenes/infoScene';
import helpScene from './scenes/helpScene';
import adminScene from './scenes/adminScene';
import adminClientsScene from './scenes/adminClientsScene';
import adminDistributorsScene from './scenes/adminDistributorsScene';


import { keyboard } from 'telegraf/typings/markup';
import { loadEnv } from './config/env';
import fs from 'fs';
import dayjs from 'dayjs';
import { attachRoles, requireRole } from './utils/rbac';

loadEnv();

// Горячая перезагрузка .env при изменении файла (для обновления ADMIN_IDS без рестарта)
// Если нужно авто-перезагружать .env в dev, можно будет добавить логику здесь


// Инициализация Redis для хранения сессий (локальный доступ)
const redis = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379');
const SESSION_TTL_SECONDS = Number(process.env.SESSION_TTL_SECONDS || 86400);
const SESSION_PREFIX = process.env.SESSION_PREFIX || 'tg:sess:';

const redisSessionStore: SessionStore<any> = {
  async get(name) {
    const raw = await redis.get(SESSION_PREFIX + name);
    return raw ? JSON.parse(raw) : undefined;
  },
  async set(name, value) {
    await redis.set(SESSION_PREFIX + name, JSON.stringify(value), 'EX', SESSION_TTL_SECONDS);
  },
  async delete(name) {
    await redis.del(SESSION_PREFIX + name);
  }
};

// Интерфейс состояния мастера
interface SearchWizardState {
  number?: string;

}

// Интерфейс WizardSession
interface MyWizardSession extends Scenes.WizardSessionData {
  state: SearchWizardState; // Указываем структуру состояния
}

// Расширяем контекст
interface MyContext extends Scenes.WizardContext<MyWizardSession> { }

// Создаём Stage
const stage = new Scenes.Stage<MyContext>([searchWizard as any, orderScene as any, registrationScene as any, profileScene as any, ordersScene as any, ordersSummaryScene as any, infoScene as any, helpScene as any, adminScene as any, adminClientsScene as any, adminDistributorsScene as any]);
// Глобальная навигация внутри сцен: кнопка «Поиск»
stage.hears('Поиск', async (ctx) => {
  try { await ctx.scene.leave(); } catch {}
  await ctx.scene.enter('search');
});
// Глобальные команды внутри любых сцен
stage.command('start', async (ctx) => {
  try { await ctx.scene.leave(); } catch {}
  const telegramId = ctx.from?.id ? String(ctx.from.id) : '';
  try {
    const client = await ClientRepository.get(telegramId);
    if (Array.isArray(client) && client.length > 0) {
      await ctx.reply('Добро пожаловать!', await getMainMenuUser());
    } else {
      await ctx.reply('Добро пожаловать! Зарегистрируйтесь, чтобы использовать все возможности.', await getMainMenuGuest());
    }
  } catch (e) {
    await ctx.reply('Добро пожаловать! Зарегистрируйтесь, чтобы использовать все возможности.', await getMainMenuGuest());
  }
});

stage.command('search', async (ctx) => {
  try { await ctx.scene.leave(); } catch {}
  await ctx.scene.enter('search');
});

stage.command('menu', async (ctx) => {
  try { await ctx.scene.leave(); } catch {}
  const telegramId = ctx.from?.id ? String(ctx.from.id) : '';
  try {
    const client = await ClientRepository.get(telegramId);
    if (Array.isArray(client) && client.length > 0) {
      await ctx.reply('Главное меню:', await getMainMenuUser());
    } else {
      await ctx.reply('Главное меню:', await getMainMenuGuest());
    }
  } catch (e) {
    await ctx.reply('Главное меню:', await getMainMenuGuest());
  }
});

stage.command('help', async (ctx) => {
  try { await ctx.scene.leave(); } catch {}
  await ctx.scene.enter('help');
});
 
// Создаём бота
const bot = new Telegraf<MyContext>(process.env.BOT_TOKEN || '');
// Отключаем webhookReply, чтобы отвечать 200 сразу и отправлять сообщения отдельно
// @ts-ignore
bot.telegram.webhookReply = false;

// Подключаем session (через Redis store) и Stage
bot.use(session({ store: redisSessionStore, defaultSession: () => ({}) }));
// RBAC: добавляем роли в контекст
bot.use(attachRoles);
bot.use(stage.middleware());
// Глобальный обработчик ошибок, чтобы бот не "зависал"
bot.catch(async (err, ctx) => {
  try {
    console.error('[Telegraf] Unhandled error:', err);
    // Не пытаемся отвечать в группах и при сетевых/парсинг ошибках
    const isParseError = err instanceof Error && /can't parse entities/i.test(err.message);
    if (ctx?.chat?.type === 'private' && isParseError) {
      try {
        await ctx.reply('⚠️ Не удалось отправить форматированное сообщение. Отправляю без форматирования.');
      } catch {}
    }
  } catch (e) {
    console.error('Ошибка в bot.catch:', e);
  }
});

// Утилита безопасной отправки (фолбэк при ошибке парсинга Markdown/HTML)
export { replySafe } from './utils/replySafe';


// Устанавливаем команды для групп


// Middleware для игнорирования всех команд в группах
bot.use((ctx, next) => {
  if (ctx.chat?.type && ctx.chat.type !== 'private') {
    return; // Игнорируем все команды и сообщения не из приватных чатов
  }
  return next();
});

bot.use((ctx, next) => {
  if (ctx.callbackQuery) {
    // console.log(`Произошло действие: ${ctx.callbackQuery.data}`); // Логируем callback_data
  }
  return next(); // Продолжаем обработку
});

// Удаляем middleware, игнорирующий сообщения в группах
// bot.use((ctx, next) => {
//   if (ctx.chat?.type && ctx.chat.type !== 'private') {
//     return; // Игнорируем все апдейты не из приватных чатов
//   }
//   return next();
// });

bot.start(async (ctx) => {
  const telegramId = String(ctx.message.from.id);
  try {
    // Проверка наличия клиента
    const client = await ClientRepository.get(telegramId);
    if (Array.isArray(client) && client.length > 0) {
      await ctx.reply('Добро пожаловать!', await getMainMenuUser());
    } else {
      await ctx.reply('Добро пожаловать! Зарегистрируйтесь, чтобы использовать все возможности.', await getMainMenuGuest());
    }
  } catch (e) {
    await ctx.reply('Добро пожаловать! Зарегистрируйтесь, чтобы использовать все возможности.', await getMainMenuGuest());
  }
});

bot.hears('Поиск', async (ctx) => {
  await ctx.scene.enter('search');
});

bot.command('search', async (ctx) => {
  try { await ctx.scene.leave(); } catch {}
  await ctx.scene.enter('search');
});

bot.command('menu', async (ctx) => {
  const telegramId = ctx.from?.id ? String(ctx.from.id) : '';
  try {
    const client = await ClientRepository.get(telegramId);
    if (Array.isArray(client) && client.length > 0) {
      await ctx.reply('Главное меню:', await getMainMenuUser());
    } else {
      await ctx.reply('Главное меню:', await getMainMenuGuest());
    }
  } catch (e) {
    await ctx.reply('Главное меню:', await getMainMenuGuest());
  }
});

bot.command('help', async (ctx) => {
  try { await ctx.scene.leave(); } catch {}
  await ctx.scene.enter('help');
});

// Пример защищённой команды: доступна только admin
bot.command('admin', requireRole(['admin']), async (ctx) => {
  // console.log('Команда admin выполнена, переход в админ сцену');
  try { await ctx.scene.leave(); } catch {}
  // @ts-ignore
  await ctx.scene.enter('admin_scene');
});


bot.hears('Регистрация', async (ctx) => {
  await ctx.scene.enter('registration');

});

bot.hears('Профиль', async (ctx) => {
  await ctx.scene.enter('profile');
});

bot.hears('Мои заказы', async (ctx) => {
  await ctx.scene.enter('orders_summary');
});




// bot.hears('text', async (ctx) => {
//   console.log(ctx.message.text)
//     // Переход в сцену поиска с этим текстом
//     // await ctx.scene.enter('search', { query: ctx.message.text });
//     await ctx.scene.enter('search');

// @ts-ignore
// bot.on('text', async (ctx) => {
//   if (ctx.message.text.startsWith('/')) {
//     // Пропускаем обработку команд
//     return;
//   }
//   // Любой другой текст = немедленный поиск
//   ctx.scene.enter('search', { searchQuery: ctx.message.text });
// });

// bot.on(message('text'), async (ctx) => {
//   if (ctx.message.text.startsWith('/')) {
//     return; // Пропускаем команды
//   }
//   console.log(ctx.message.text);
//   // await ctx.scene.enter('search', { step: 2 }); // переход сразу к step2
//   await ctx.scene.enter('search'); // переход сразу к step2
// });

bot.command('ver', async (ctx) => {
  const packageJson = require('../package.json');
  const version = packageJson.version;
  const stats = fs.statSync(require.resolve('../package.json'));
  const modifiedTime = dayjs(stats.mtime).format('YYYY-MM-DD HH:mm:ss');
  await ctx.reply(`Версия: ${version} (${modifiedTime})`);
});

// Временная команда для диагностики уведомлений
bot.command('testnotify', async (ctx) => {
  try {
    const text = (ctx.message && 'text' in ctx.message) ? (ctx.message.text || '') : '';
    const parts = text.trim().split(/\s+/);
    const argChatId = parts.length > 1 ? parts[1] : '';

    const targetChatId = argChatId || process.env.REGISTRATION_NOTIFY_CHAT_ID || process.env.TEST_CHAT_ID;

    if (!targetChatId) {
      await ctx.reply(`⚠️ Не задан Chat ID для теста.

Использование:
/testnotify <chat_id>

Либо настройте переменную окружения:
REGISTRATION_NOTIFY_CHAT_ID=<chat_id>`);
      return;
    }

    const { OrderRepository } = await import('./repositories/orderRepository');
    const result = await OrderRepository.testNotification(targetChatId);

    await ctx.reply(result.success ? `✅ Тестовое сообщение отправлено в ${targetChatId}` : `❌ Ошибка: ${result.message}`);
  } catch (error) {
    console.error('Ошибка в команде testnotify:', error);
    await ctx.reply(`❌ Ошибка: ${error instanceof Error ? error.message : String(error)}`);
  }
});

// Команда для установки Chat ID группы
bot.command('setnotifychat', async (ctx) => {
  try {
    const text = (ctx.message && 'text' in ctx.message) ? (ctx.message.text || '') : '';
    const parts = text.trim().split(/\s+/);
    const argChatId = parts.length > 1 ? parts[1] : '';

    if (!argChatId) {
      await ctx.reply(`Укажите Chat ID группы.

Использование: /setnotifychat <chat_id>

Затем добавьте в .env:
\`\`\`
REGISTRATION_NOTIFY_CHAT_ID=<chat_id>
\`\`\`
или выполните в терминале:
\`\`\`
export REGISTRATION_NOTIFY_CHAT_ID="<chat_id>"
\`\`\``);
      return;
    }

    const message = `✅ Chat ID группы: \`${argChatId}\`

📋 Добавьте в файл \`.env.dev\`:
\`\`\`
REGISTRATION_NOTIFY_CHAT_ID=${argChatId}
\`\`\`

Или выполните в терминале:
\`\`\`
export REGISTRATION_NOTIFY_CHAT_ID="${argChatId}"
\`\`\`

После настройки все новые заказы и регистрации будут приходить в эту группу.`;

    await ctx.reply(message);
  } catch (error) {
    console.error('Ошибка в команде setnotifychat:', error);
    await ctx.reply(`❌ Ошибка: ${error instanceof Error ? error.message : String(error)}`);
  }
});

bot.command('getchatid', async (ctx) => {
  try {
    const chatId = ctx.chat?.id?.toString();
    const chatType = ctx.chat?.type;

    let message = `📍 Информация о чате:
Chat ID: \`${chatId}\`
Тип: ${chatType}`;

    await ctx.reply(message);
  } catch (error) {
    console.error('Ошибка в команде getchatid:', error);
    await ctx.reply(`❌ Ошибка: ${error instanceof Error ? error.message : String(error)}`);
  }
});


(async () => {
  try {
    // Сначала очищаем команды в дефолтном и групповых скоупах,
    // чтобы в группах подсказки по '/' не отображались
    await bot.telegram.setMyCommands([], { scope: { type: 'default' } });
    await bot.telegram.setMyCommands([], { scope: { type: 'all_group_chats' } });
    await bot.telegram.setMyCommands([], { scope: { type: 'all_chat_administrators' } });

    await bot.telegram.setMyCommands([
      { command: 'start', description: 'Начало' },
      { command: 'search', description: 'Поиск' },
      { command: 'order', description: 'Заказы' },
      // { command: 'menu', description: 'Меню' },
      { command: 'help', description: 'Помощь' },
      { command: 'ver', description: 'Версия' },
      { command: 'testnotify', description: 'Тест уведомлений' },
      { command: 'setnotifychat', description: 'Настроить Chat ID группы' },
    ], { scope: { type: 'all_private_chats' } });

    // await bot.telegram.setMyCommands([
    //   { command: 'start', description: 'Начало' },
    //   { command: 'search', description: 'Поиск' },
    //   { command: 'order', description: 'Заказы' },
    //   { command: 'help', description: 'Помощь' },
    //   { command: 'ver', description: 'Версия' },
    //   { command: 'testnotify', description: 'Тест уведомлений' },
    //   { command: 'setnotifychat', description: 'Настроить Chat ID группы' },
    // ], { scope: { type: 'all_group_chats' } });
  } catch (e) {
    console.error('Не удалось установить команды бота:', e);
  }
})();



export { bot };
