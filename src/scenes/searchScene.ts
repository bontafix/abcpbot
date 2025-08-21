import { Telegraf, session, Scenes } from 'telegraf';
import * as dotenv from 'dotenv';
import { UserRepository } from '../repositories/userRepository';
import { searchBrands, searchArticles } from '../abcp';


const ABCP_HOST = process.env.ABCP_HOST;
const ABCP_USER = process.env.ABCP_USER;
const ABCP_PASS = process.env.ABCP_PASS;
// Интерфейс состояния мастера
interface SearchWizardState {
  number?: string;
  results?: SearchResultMap;
  selectedBrandNumber?: string;
}


// Интерфейс WizardSession
interface MyWizardSession extends Scenes.WizardSessionData {
  state: SearchWizardState; // Указываем структуру состояния
}

// Расширяем контекст
interface MyContext extends Scenes.WizardContext<MyWizardSession> { }

// Создаём шаги мастера
const step1 = async (ctx: MyContext) => {
  await ctx.reply('Введите код запчасти:');
  return ctx.wizard.next(); // Переход к следующему шагу
  // return ctx.scene.leave();
};

const step2 = async (ctx: MyContext) => {
  // Middleware для обработки команд
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
    const state = ctx.wizard.state as SearchWizardState;
    state.number = ctx.message.text;

    if (ABCP_HOST && ABCP_USER && ABCP_PASS) {
      const resultSearch = await searchBrands(ABCP_HOST, ABCP_USER, ABCP_PASS, state.number);
      state.results = resultSearch as SearchResultMap;

      const entries = Object.entries(state.results || {}) as [string, SearchResultItem][];
      if (entries.length > 0) {
        const buttons = entries.map(([key, item]) => [
          { text: `${item.brand} - ${item.description}`, callback_data: key }
        ]);

        // Добавляем кнопку "Другой запрос" в конец
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
        return ctx.scene.reenter();  // Возврат на предыдущий шаг
        // await ctx.scene.reenter(); // вернуться к step1
      }
    } else {
      await ctx.reply('Ошибка доступа к Abcp API. Попробуйте позже.');
    }
    return ctx.wizard.next();
  }

  await ctx.reply('Пожалуйста, выберите вариант из списка или введите текст.');
};

const step3 = async (ctx: MyContext) => {
  const state = ctx.wizard.state as SearchWizardState;

  if (ctx.callbackQuery && 'data' in ctx.callbackQuery) {
    const data = (ctx.callbackQuery as any).data as string;

    // Обработка кнопки «Новый поиск»
    if (data === 'restart_search') {
      await ctx.answerCbQuery();
      const s = ctx.wizard.state as SearchWizardState;
      if (s) {
        delete s.number;
        delete s.results;
        delete s.selectedBrandNumber;
      }
      await ctx.scene.reenter(); // вернуться к step1
      return;
    }

    // Обработка кнопки «Заказать»
    if (data.startsWith('order:')) {
      await ctx.answerCbQuery();
      const [, brand, number, availabilityRaw] = data.split(':');
      const availability = availabilityRaw ? Number(availabilityRaw) : undefined;
      await ctx.scene.enter('order' as any, { brand, number, availability });
      return;
    }

    // Обработка выбора бренда/позиции из step2
    const key = data;
    const selectedItem = state.results?.[key];

    if (!selectedItem?.number || !selectedItem?.brand || !ABCP_HOST || !ABCP_USER || !ABCP_PASS) {
      await ctx.answerCbQuery('Нет данных для запроса', { show_alert: true });
      // Предложить начать новый поиск
      await ctx.reply('Сделать новый поиск?', {
        reply_markup: { inline_keyboard: [[{ text: 'Новый поиск', callback_data: 'restart_search' }]] }
      });
      return;
    }

    const resultSearchArticles = await searchArticles(
      ABCP_HOST, ABCP_USER, ABCP_PASS,
      selectedItem.number, selectedItem.brand
    );

    const articles = (resultSearchArticles as any[]) || [];
    if (articles.length === 0) {
      await ctx.reply('2 Ничего не найдено.');
      await ctx.reply('Сделать новый поиск?', {
        reply_markup: { inline_keyboard: [[{ text: 'Новый поиск', callback_data: 'restart_search' }]] }
      });
      await ctx.answerCbQuery();
      return;
    }
    console.log(articles);
    articles.sort((a, b) => Number(Boolean(a.isAnalog)) - Number(Boolean(b.isAnalog)));
    for (const a of articles) {
      const md = `*Брэнд*: ${String(a.brand)}\n` +
        `*Артикул*: ${String(a.number)} ${a.isAnalog ? " (🔸Оригинальная замена. )" : ""}\n` +
        `*Описание*: ${String(a.description ?? '-')}\n` +
        `*Доступно*: ${String(a.availability ?? '-')}\n` +
        `*Срок*: ${String(a.deliveryProbability === 0 ? 'На складе' : a.descriptionOfDeliveryProbability)}\n` +
        `*Цена*: ${formatPrice(a.price)}\n `;
        `*Вес*: ${formatPrice(a.weight)}\n `;
      //  `${a.isAnalog ? "Оригинальная замена!" : ""}`;

      await ctx.reply(md, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[
            { text: 'Заказать', callback_data: `order:${a.brand}:${a.number}:${a.availability ?? ''}` },
            { text: 'Новый поиск', callback_data: 'restart_search' }
          ]]
        }
      });
    }

    // Убираем отдельное сообщение с предложением нового поиска, так как кнопка есть на каждой карточке
    await ctx.answerCbQuery();
    return; // остаёмся на step3, ждём нажатия «Новый поиск» или «Заказать»
  }
  return; // ждём действия пользователя
};

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

// Утилита форматирования цены: пробелы для тысяч и 2 знака после точки
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