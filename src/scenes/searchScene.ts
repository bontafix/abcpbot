import { Telegraf, session, Scenes } from 'telegraf';
import * as dotenv from 'dotenv';
import { UserRepository } from '../repositories/userRepository';
import { searchBrands, searchArticles } from '../abcp';

// Интерфейс состояния мастера
interface SearchWizardState {
  number?: string;
  results?: SearchResultMap;
  selectedBrandNumber?: string;
  analogArticles?: any[]; // Добавляем хранение аналогов
  itemDetails?: Record<string, {
    title: string;
    price: number;
    distributorId: string;
    brand: string;
    supplierCode?: string;
    lastUpdateTime?: string;
    availability?: number;
    availabilityTransformed?: unknown;
  }>; // Детали позиции для оформления заказа
}

// Интерфейс WizardSession
interface MyWizardSession extends Scenes.WizardSessionData {
  state: SearchWizardState;
}

// Расширяем контекст
interface MyContext extends Scenes.WizardContext<MyWizardSession> { }

// Создаём шаги мастера
const step1 = async (ctx: MyContext) => {
  // Если пришли из отмены оформления или возврата из Info, сразу покажем предложения без запроса ввода
  const state = ctx.wizard.state as SearchWizardState;
  const resume = (ctx.scene.state || {}) as { resumeBrand?: string; resumeNumber?: string; resumeFromInfo?: boolean };

  // Возврат из сцены Info: восстанавливаем состояние поиска и переходим к шагу обработки кнопок
  if (resume.resumeFromInfo && (ctx as any).session && (ctx as any).session.searchState) {
    try {
      const saved = (ctx as any).session.searchState as Partial<SearchWizardState>;
      Object.assign(state, saved || {});
    } finally {
      try { delete (ctx as any).session.searchState; } catch {}
    }
    return ctx.wizard.selectStep(2);
  }
  if (resume.resumeNumber && resume.resumeBrand) {
    state.number = resume.resumeNumber;
    console.log('process.env.PROFILE_ID', process.env.PROFILE_ID);
      const resultSearchArticles = await searchArticles(
        resume.resumeNumber, resume.resumeBrand, process.env.PROFILE_ID || ''
      );

    const articles = (resultSearchArticles as any[]) || [];
    // console.log(resultSearchArticles);
    // console.log(`2 resultSearchArticles =====================`);
    if (articles.length === 0) {
      await ctx.reply('Не найдено. Введите код запчасти:');
      return ctx.wizard.next();
    }

    const { analogArticles, nonAnalogArticles } = sortAndSplitArticles(articles);
    updateItemDetails(state, articles);
    state.analogArticles = analogArticles;
    await sendItems(ctx, nonAnalogArticles);
    await replyAnalogsButton(ctx, analogArticles.length);

    // Переходим к шагу 3, чтобы обрабатывать нажатия
    return ctx.wizard.selectStep(2);
  }

  await ctx.reply('Введите код запчасти:', {
    reply_markup: {
      keyboard: [[{ text: 'История' }, { text: 'Очистить историю' }], [{ text: 'Назад' }]],
      resize_keyboard: true,
      one_time_keyboard: false,
    } as any,
  } as any);
  return ctx.wizard.next();
};

const step2 = async (ctx: MyContext) => {
  if (ctx.message && 'text' in ctx.message && ctx.message.text.startsWith('/')) {
    switch (ctx.message.text) {
      case '/start':
        await ctx.reply('Поиск отменен. Вы вышли из режима поиска.');
        return ctx.scene.leave();
      case '/cancel':
        await ctx.reply('Поиск отменен.');
        return ctx.scene.leave();
      default:
        await ctx.reply('Эта команда недоступна в режиме поиска. Используйте /cancel для выхода.');
        return;
    }
  }

  if (ctx.message && 'text' in ctx.message) {
    // История
    if (ctx.message.text === 'История') {
      const telegramId = ctx.from?.id ? String(ctx.from.id) : '';
      if (!telegramId) {
        await ctx.reply('Не удалось определить Telegram ID.');
        return;
      }
      const { SearchHistoryRepository } = await import('../repositories/searchHistoryRepository');
      const rows = await SearchHistoryRepository.last(telegramId, 10);
      if (!Array.isArray(rows) || rows.length === 0) {
        await ctx.reply('История пуста.');
        return;
      }
      const textOut = rows.map((x: any, i: number) => `${i + 1}. ${x.query}`).join('\n');
      await ctx.reply(textOut || 'История пуста.');
      return; // остаёмся на шаге 2
    }

    // Назад
    if (ctx.message.text === 'Назад') {
      const { getMainMenuUser } = await import('../menu');
      await ctx.reply('Возвращаемся в меню.', await getMainMenuUser());
      return ctx.scene.leave();
    }

    // Очистить историю
    if (ctx.message.text === 'Очистить историю') {
      const telegramId = ctx.from?.id ? String(ctx.from.id) : '';
      if (!telegramId) {
        await ctx.reply('Не удалось определить Telegram ID.');
        return;
      }
      const { SearchHistoryRepository } = await import('../repositories/searchHistoryRepository');
      await SearchHistoryRepository.clear(telegramId);
      await ctx.reply('История очищена.');
      return; // остаёмся на шаге 2
    }
    const state = ctx.wizard.state as SearchWizardState;
    state.number = ctx.message.text;
    console.log(state.number);
    {
      const resultSearch = await searchBrands(state.number);
      state.results = resultSearch as SearchResultMap;
      // console.log('results saved', {
      //   query: state.number,
      //   count: Object.keys(state.results || {}).length,
      //   sample: Object.entries(state.results || {})[0]
      // });

      // console.log(state.results);
      // console.log(`state.results =====================`);

      const entries_ = Object.entries(state.results || {}) as [string, SearchResultItem][];
      console.log(entries_);
      const entries = entries_;
      // Сохраняем запрос в историю с количеством найденных позиций
      try {
        const telegramId = ctx.from?.id ? String(ctx.from.id) : '';
        if (telegramId) {
          const { SearchHistoryRepository } = await import('../repositories/searchHistoryRepository');
        //   console.log(state.number, entries.length);
        //  console.log(`SearchHistoryRepository.add =====================`);
          await SearchHistoryRepository.add(telegramId, state.number || '', entries.length);
        }
      } catch {}
      
      if (entries.length > 0) {
        const buttons = entries.map(([key, item]) => [
          { text: `${item.brand} - ${item.description}`, callback_data: key }
        ]);

        buttons.push([
          { text: "🔍 Другой запрос", callback_data: "restart_search" }
        ]);

        await ctx.reply('Выберите вариант:', {
          reply_markup: {
            inline_keyboard: buttons
          }
        });
      } else {
        await ctx.reply('Ничего не найдено.');
        // На случай нулевого результата (дублирующая запись не создаётся выше)
        // Возвращаемся к вводу
        return ctx.scene.reenter();
      }
    }
    return ctx.wizard.next();
  }

  await ctx.reply('Пожалуйста, выберите вариант из списка или введите текст.');
};

const step3 = async (ctx: MyContext) => {
  const state = ctx.wizard.state as SearchWizardState;

  // Разрешаем глобальные слеш-команды даже на шаге результатов
  if (ctx.message && 'text' in ctx.message && ctx.message.text.startsWith('/')) {
    switch (ctx.message.text) {
      case '/start':
      case '/menu':
      case '/search':
      case '/help':
      case '/cancel':
        // Выходим из сцены и позволяем глобальным хэндлерам обработать команду
        try { await ctx.scene.leave(); } catch {}
        return;
      default:
        await ctx.reply('Эта команда недоступна в режиме просмотра результатов. Используйте /cancel или кнопку "Новый поиск".');
        return;
    }
  }

  if (ctx.callbackQuery && 'data' in ctx.callbackQuery) {
    const data = (ctx.callbackQuery as any).data as string;

    // Обработка кнопки «Новый поиск» → показываем меню поиска на шаге ввода
    if (data === 'restart_search') {
      await ctx.answerCbQuery();
      const s = ctx.wizard.state as SearchWizardState;
      if (s) {
        delete s.number;
        delete s.results;
        delete s.selectedBrandNumber;
        delete s.analogArticles;
      }
      await ctx.reply('Введите код запчасти:', {
        reply_markup: {
          keyboard: [[{ text: 'История' }, { text: 'Назад' }]],
          resize_keyboard: true,
          one_time_keyboard: false,
        } as any,
      } as any);
      // Переходим к шагу 2 (обработчик ввода и меню)
      ctx.wizard.selectStep(1);
      return;
    }

    // Обработка кнопки «Показать аналоги»
    if (data === 'show_analogs') {
      await ctx.answerCbQuery();
      await showAnalogArticles(ctx);
      return;
    }

    // Обработка кнопки «Инфо»
    if (data.startsWith('info:')) {
      await ctx.answerCbQuery();
      const [, brand, number] = data.split(':');
      // Сохраняем текущее состояние поиска в сессию, чтобы восстановить без перерисовки
      try {
        const snapshot = JSON.parse(JSON.stringify(ctx.wizard.state));
        (ctx as any).session.searchState = snapshot;
      } catch {
        (ctx as any).session.searchState = (ctx.wizard.state as any);
      }
      await ctx.scene.enter('info' as any, { brand, number });
      return;
    }

    // Обработка кнопки «Заказать»
    if (data.startsWith('order:')) {
      await ctx.answerCbQuery();
      const [, brand, number, availabilityRaw] = data.split(':');
      const availability = availabilityRaw ? Number(availabilityRaw) : undefined;
      const key2 = `${brand}:${number}`;
      const details = (state.itemDetails || {})[key2] || { title: '', price: 0 };
      await ctx.scene.enter('order' as any, {
        brand,
        number,
        availability,
        title: details.title,
        price: details.price,
        distributorId: (details as any).distributorId || '',
        supplierCode: (details as any).supplierCode || '',
        lastUpdateTime: (details as any).lastUpdateTime || '',
        availabilityTransformed: (details as any).availabilityTransformed,
      });
      return;
    }

    // Обработка выбора бренда/позиции из step2
    const key = data;
    console.log('cb key', key);
    console.log('results present', !!state.results, 'count', Object.keys(state.results || {}).length);
    const selectedItem = state.results?.[key];

    if (!selectedItem?.number || !selectedItem?.brand) {
      await ctx.answerCbQuery('Нет данных для запроса', { show_alert: true });
      await ctx.reply('Сделать новый поиск?', {
        reply_markup: { inline_keyboard: [[{ text: 'Новый поиск', callback_data: 'restart_search' }]] }
      });
      return;
    }
    console.log('process.env.PROFILE_ID', process.env.PROFILE_ID);
    const resultSearchArticles = await searchArticles(
      selectedItem.number, selectedItem.brand, process.env.PROFILE_ID || ''
    );
    // console.log(resultSearchArticles);
    // console.log(`resultSearchArticles >>>> =====================`);
    const articles = (resultSearchArticles as any[]) || [];
    if (articles.length === 0) {
      await ctx.reply('Не найдено.');
      await ctx.reply('Сделать новый поиск?', {
        reply_markup: { inline_keyboard: [[{ text: 'Новый поиск', callback_data: 'restart_search' }]] }
      });
      await ctx.answerCbQuery();
      return;
    }

    const { analogArticles, nonAnalogArticles } = sortAndSplitArticles(articles);
    updateItemDetails(state, articles);
    state.analogArticles = analogArticles;
    await sendItems(ctx, nonAnalogArticles);
    await replyAnalogsButton(ctx, analogArticles.length);

    await ctx.answerCbQuery();
    return;
  }
  return;
};

// Функция для показа аналогов
async function showAnalogArticles(ctx: MyContext) {
  const state = ctx.wizard.state as SearchWizardState;
  const analogArticles = state.analogArticles || [];

  if (analogArticles.length === 0) {
    await ctx.reply('Аналоги не найдены.');
    return;
  }

  await ctx.reply(`🔸 *Оригинальные замены (${analogArticles.length}):*`, {
    parse_mode: 'Markdown'
  });

  // Показываем аналогичные товары
  await sendItems(ctx, analogArticles);
}

// Интерфейс для результата поиска
interface SearchResultItem {
  availability: number;
  brand: string;
  description: string;
  number: string;
  numberFix: string;
}

interface SearchResultMap {
  [key: string]: SearchResultItem;
}

// Создаём мастер
const searchWizard = new Scenes.WizardScene<MyContext>(
  'search',
  step1,
  step2,
  step3
);

// Утилита форматирования цены
function formatPrice(value: unknown): string {
  const num = Number(value);
  if (!Number.isFinite(num)) return '-';
  const sign = num < 0 ? '-' : '';
  const abs = Math.abs(num);
  const [intPart, fracPart] = abs.toFixed(2).split('.');
  const intWithSpaces = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${sign}${intWithSpaces}.${fracPart}`;
}

export default searchWizard;

// Публичный шаблон показа позиции (строго белый список полей)
function renderPublicItem(a: any): string {
  return `*Брэнд*: ${String(a.brand)}\n` +
    `*Артикул*: ${String(a.number)}\n` +
    `*Описание*: ${String(a.description ?? '-')}\n` +
    `*Доступно*: ${String(a.availabilityTransformed ?? a.availability ?? '-')}\n` +
    // `*Срок*: ${String(a.deliveryProbability === 0 ? 'На складе' : a.descriptionOfDeliveryProbability)}\n` +
    `*Срок*: ${String(a.deliveryPeriod === 0 ? 'На складе' : `${a.deliveryPeriod} часа`)}\n` +
    `*Цена*: ${formatPrice(a.price)}\n` +
    `*Вес*: ${String(a.weight)}`;
}

// Хелперы для снижения дублирования
function sortAndSplitArticles(articles: any[]) {
  const sorted = [...articles];
  sorted.sort((a, b) => Number(Boolean(a.isAnalog)) - Number(Boolean(b.isAnalog)));
  const analogArticles = sorted.filter(a => a.isAnalog);
  const nonAnalogArticles = sorted.filter(a => !a.isAnalog);
  return { analogArticles, nonAnalogArticles };
}

function updateItemDetails(state: SearchWizardState, articles: any[]) {
  const detailsMap: Record<string, {
    title: string;
    price: number;
    distributorId: string;
    brand: string;
    supplierCode?: string;
    lastUpdateTime?: string;
    availability?: number;
    availabilityTransformed?: unknown;
  }> = (state.itemDetails ||= {} as any);
  for (const a of articles) {
    const key2 = `${String(a.brand)}:${String(a.number)}`;
    detailsMap[key2] = {
      title: String(a.description ?? '-'),
      price: Number(a.price ?? 0),
      distributorId: String((a as any).distributorId ?? ''),
      brand: String(a.brand ?? ''),
      supplierCode: String((a as any).supplierCode ?? ''),
      lastUpdateTime: String((a as any).lastUpdateTime ?? ''),
      availability: typeof a.availability === 'number' ? Number(a.availability) : undefined,
      availabilityTransformed: (a as any).availabilityTransformed,
    };
  }
}

function getOrderInlineKeyboard(a: any) {
  return {
    inline_keyboard: [[
      { text: 'Заказать', callback_data: `order:${a.brand}:${a.number}:${a.availability ?? ''}` },
      // { text: 'Инфо', callback_data: `info:${a.brand}:${a.number}` },
      { text: 'Новый поиск', callback_data: 'restart_search' }
    ]]
  } as any;
}

async function sendItems(ctx: MyContext, items: any[]) {
  for (const a of items) {
    await ctx.reply(renderPublicItem(a), {
      parse_mode: 'Markdown',
      reply_markup: getOrderInlineKeyboard(a)
    } as any);
  }
}

async function replyAnalogsButton(ctx: MyContext, analogCount: number) {
  if (analogCount <= 0) return;
  await ctx.reply(`Найдены аналоги: ${analogCount}`, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [[
        { text: `📋 Показать аналоги`, callback_data: 'show_analogs' },
        { text: 'Новый поиск', callback_data: 'restart_search' }
      ]]
    }
  } as any);
}

// availabilityTransformed теперь формируется в abcp.searchArticles