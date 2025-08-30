import { Scenes } from 'telegraf';
import { ClientRepository } from '../repositories/clientRepository';
import { getMainMenuGuest, getMainMenuUser } from '../menu';
import { SettingsService } from '../services/settingsService';

type AnyContext = Scenes.WizardContext & { scene: any; wizard: any };

interface HelpWizardState {
  pageIndex?: number;
  lastMessageId?: number;
}

const PAGES: string[] = [
  'Документация — страница 1\n\nЗдесь будет краткое описание возможностей бота и как начать.',
  'Документация — страница 2\n\nОписания сцен поиска, заказов и профиля.',
  'Документация — страница 3\n\nПодсказки, ответы на частые вопросы и контакты.',
];

// Централизованные тексты кнопок меню помощи
const HELP_MENU_TEXTS = {
  pages: ['Инструкция', 'О поиске', 'О заказах'],
  main: 'Главное меню',
} as const;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function getHelpKeyboard() {
  return {
    keyboard: [
      [{ text: HELP_MENU_TEXTS.pages[0] }, 
      { text: HELP_MENU_TEXTS.pages[1] },
      { text: HELP_MENU_TEXTS.pages[2] }],
      [{ text: HELP_MENU_TEXTS.main }],
    ],
    resize_keyboard: true,
    one_time_keyboard: false,
  } as any;
}

async function replyPage(ctx: AnyContext) {
  const s = ctx.wizard.state as HelpWizardState;
  const lastIndex = PAGES.length - 1;
  const pageIndex = clamp(Number(s.pageIndex ?? 0), 0, lastIndex);
  s.pageIndex = pageIndex;

  // Подтягиваем сохранённый текст из настроек help, если есть
  const keyByIndex: Record<number, string> = {
    0: 'instruction',
    1: 'search',
    2: 'orders',
  };
  let text = PAGES[pageIndex];
  try {
    const k = keyByIndex[pageIndex];
    if (k) {
      const saved = await SettingsService.get('help', k);
      if (typeof saved === 'string' && saved.trim().length > 0) {
        text = saved;
      }
    }
  } catch {}

  // Удаляем предыдущее сообщение бота, если есть
  if (s.lastMessageId) {
    try { await ctx.deleteMessage(s.lastMessageId); } catch {}
    s.lastMessageId = undefined;
  }

  // Отправляем новое сообщение с учётом возможных ошибок парсинга
  const extra: any = { reply_markup: getHelpKeyboard(), parse_mode: 'Markdown' };
  let msg: any = null;
  try {
    msg = await ctx.reply(text, extra);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/can't parse entities|wrong entity/i.test(message)) {
      try { msg = await ctx.reply(text, { reply_markup: getHelpKeyboard() } as any); } catch {}
      if (!msg) {
        try { msg = await ctx.reply(String(text), { reply_markup: getHelpKeyboard() } as any); } catch {}
      }
    }
  }
  if (msg && msg.message_id) {
    s.lastMessageId = msg.message_id as number;
  }
}

const helpStep = async (ctx: AnyContext) => {
  // Вход по /help или первичный вход — показать первую страницу с обычным меню
  if (!ctx.callbackQuery && (!ctx.message || ('text' in ctx.message && (ctx.message.text || '').trim().startsWith('/help')))) {
    (ctx.wizard.state as HelpWizardState).pageIndex = 0;
    await replyPage(ctx);
    return;
  }

  if (ctx.message && 'text' in ctx.message) {
    const t = (ctx.message.text || '').trim();
    const s = ctx.wizard.state as HelpWizardState;
    if (t === HELP_MENU_TEXTS.pages[0]) {
      s.pageIndex = 0;
      try { await ctx.deleteMessage(); } catch {}
      await replyPage(ctx);
      return;
    }
    if (t === HELP_MENU_TEXTS.pages[1]) {
      s.pageIndex = 1;
      try { await ctx.deleteMessage(); } catch {}
      await replyPage(ctx);
      return;
    }
    if (t === HELP_MENU_TEXTS.pages[2]) {
      s.pageIndex = 2;
      try { await ctx.deleteMessage(); } catch {}
      await replyPage(ctx);
      return;
    }
    if (t === HELP_MENU_TEXTS.main || t === '/menu') {
      // Пытаемся зачистить последнее сообщение помощи
      if (s.lastMessageId) { try { await ctx.deleteMessage(s.lastMessageId); } catch {} }
      const telegramId = ctx.from?.id ? String(ctx.from.id) : '';
      try {
        const client = telegramId ? await ClientRepository.get(telegramId) : [];
        if (Array.isArray(client) && client.length > 0) {
          await ctx.reply('Главное меню:', await getMainMenuUser());
        } else {
          await ctx.reply('Главное меню:', await getMainMenuGuest());
        }
      } catch {
        await ctx.reply('Главное меню:', await getMainMenuGuest());
      }
      return ctx.scene.leave();
    }

    await ctx.reply('Выберите пункт меню ниже.', { reply_markup: getHelpKeyboard() } as any);
    return;
  }
};

const helpScene = new Scenes.WizardScene<AnyContext>(
  'help',
  helpStep
);

export default helpScene;


