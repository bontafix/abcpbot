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


import { keyboard } from 'telegraf/typings/markup';
import * as dotenv from 'dotenv';
import fs from 'fs';
import dayjs from 'dayjs';
import { attachRoles, requireRole } from './utils/rbac';

const envFile = process.env.NODE_ENV === 'production' ? '.env.prod' : '.env.dev';
dotenv.config({ path: envFile });

// Горячая перезагрузка .env при изменении файла (для обновления ADMIN_IDS без рестарта)
try {
  fs.watch(envFile, { persistent: false }, () => {
    try {
      dotenv.config({ path: envFile, override: true });
      // console.log('ENV reloaded');
    } catch {}
  });
} catch {}


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
const stage = new Scenes.Stage<MyContext>([searchWizard as any, orderScene as any, registrationScene as any, profileScene as any, ordersScene as any, ordersSummaryScene as any, infoScene as any, helpScene as any, adminScene as any, adminClientsScene as any]);
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


bot.use((ctx, next) => {
  // console.log('Получен апдейт:', ctx.update);
  return next();
});

bot.use((ctx, next) => {
  if (ctx.callbackQuery) {
    // console.log(`Произошло действие: ${ctx.callbackQuery.data}`); // Логируем callback_data
  }
  return next(); // Продолжаем обработку
});

// Блокируем работу бота в группах и супергруппах
bot.use((ctx, next) => {
  if (ctx.chat?.type && ctx.chat.type !== 'private') {
    return; // Игнорируем все апдейты не из приватных чатов
  }
  return next();
});

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



(async () => {
  try {
    await bot.telegram.setMyCommands([
      { command: 'start', description: 'Начало' },
      { command: 'search', description: 'Поиск' },
      { command: 'order', description: 'Заказы' },
      // { command: 'menu', description: 'Меню' },
      { command: 'help', description: 'Помощь' },
      { command: 'ver', description: 'Версия' },
    ], { scope: { type: 'all_private_chats' } });

    // Убираем команды в группах/супергруппах
    await bot.telegram.setMyCommands([], { scope: { type: 'all_group_chats' } });
  } catch (e) {
    console.error('Не удалось установить команды бота:', e);
  }
})();



export { bot };
