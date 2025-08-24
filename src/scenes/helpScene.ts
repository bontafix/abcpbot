import { Scenes } from 'telegraf';
import { ClientRepository } from '../repositories/clientRepository';
import { getMainMenuGuest, getMainMenuUser } from '../menu';

type AnyContext = Scenes.WizardContext & { scene: any; wizard: any };

interface HelpWizardState {
  pageIndex?: number;
}

const PAGES: string[] = [
  'Документация — страница 1\n\nЗдесь будет краткое описание возможностей бота и как начать.',
  'Документация — страница 2\n\nОписания сцен поиска, заказов и профиля.',
  'Документация — страница 3\n\nПодсказки, ответы на частые вопросы и контакты.',
];

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

async function replyPage(ctx: AnyContext) {
  const s = ctx.wizard.state as HelpWizardState;
  const lastIndex = PAGES.length - 1;
  const pageIndex = clamp(Number(s.pageIndex ?? 0), 0, lastIndex);
  s.pageIndex = pageIndex;

  const buttons: any[] = [];
  const row: any[] = [];
  if (pageIndex > 0) row.push({ text: '◀️ Назад', callback_data: 'help_prev' });
  if (pageIndex < lastIndex) row.push({ text: 'Вперёд ▶️', callback_data: 'help_next' });
  if (row.length > 0) buttons.push(row);
  buttons.push([
    { text: 'В меню', callback_data: 'help_menu' },
    { text: 'Закрыть', callback_data: 'help_close' },
  ]);

  await ctx.reply(PAGES[pageIndex], {
    reply_markup: { inline_keyboard: buttons },
    parse_mode: 'Markdown'
  } as any);
}

const helpStep = async (ctx: AnyContext) => {
  // Первичный показ страницы
  if (!ctx.callbackQuery && !ctx.message) {
    await replyPage(ctx);
    return;
  }

  if (ctx.callbackQuery && 'data' in ctx.callbackQuery) {
    const data = (ctx.callbackQuery as any).data as string;
    const s = ctx.wizard.state as HelpWizardState;
    if (data === 'help_prev') {
      s.pageIndex = clamp(Number(s.pageIndex ?? 0) - 1, 0, PAGES.length - 1);
      await ctx.answerCbQuery();
      await replyPage(ctx);
      return;
    }
    if (data === 'help_next') {
      s.pageIndex = clamp(Number(s.pageIndex ?? 0) + 1, 0, PAGES.length - 1);
      await ctx.answerCbQuery();
      await replyPage(ctx);
      return;
    }
    if (data === 'help_close') {
      await ctx.answerCbQuery('Закрыто');
      return ctx.scene.leave();
    }
    if (data === 'help_menu') {
      await ctx.answerCbQuery();
      // Переход в главное меню с учётом регистрации
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
  }

  if (ctx.message && 'text' in ctx.message) {
    const t = (ctx.message.text || '').trim();
    if (t === '/menu') {
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
    await ctx.reply('Используйте кнопки ниже для навигации. Команда /menu — возврат в меню.');
    return;
  }
};

const helpScene = new Scenes.WizardScene<AnyContext>(
  'help',
  helpStep
);

export default helpScene;


