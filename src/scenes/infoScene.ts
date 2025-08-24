import { Scenes } from 'telegraf';
import { getArticlesInfo } from '../abcp';
// import { getMainMenuUser, getMainMenuGuest } from '../menu';

type AnyContext = Scenes.WizardContext & { scene: any; wizard: any };

const infoStep1 = async (ctx: AnyContext) => {
  const sceneState = (ctx.scene.state || {}) as { brand?: string; number?: string };
  const brand = sceneState.brand || '';
  const number = sceneState.number || '';

  if (!brand || !number) {
    await ctx.reply('Нет данных для запроса.');
    return ctx.scene.leave();
  }

  // Сохраняем в wizard.state для шага «Назад»
  const s = ctx.wizard.state as { brand?: string; number?: string; infoMessageIds?: number[] };
  s.brand = brand;
  s.number = number;
  s.infoMessageIds = [];

  const head = await ctx.reply(`Информация по позиции\nБрэнд: ${brand}\nАртикул: ${number}`);
  try {
    const mid = (head as any)?.message_id;
    if (typeof mid === 'number') s.infoMessageIds.push(mid);
  } catch {}

  try {
    const format = 'bnpi'
    const data = await getArticlesInfo(brand, number, format);
    if (!data || (Array.isArray(data) && data.length === 0)) {
      await ctx.reply('Данные не найдены.');
    } else {
      const text = String(typeof data === 'string' ? data : JSON.stringify(data, null, 2));
      const chunk = text.slice(0, 3500);
      const msg = await ctx.reply(chunk);
      try {
        const mid = (msg as any)?.message_id;
        if (typeof mid === 'number') s.infoMessageIds.push(mid);
      } catch {}
      if (text.length > chunk.length) {
        const cut = await ctx.reply('…данные обрезаны. Уточните запрос.');
        try {
          const mid = (cut as any)?.message_id;
          if (typeof mid === 'number') s.infoMessageIds.push(mid);
        } catch {}
      }
    }
  } catch (e) {
    // При ошибке: очищаем свои сообщения и возвращаемся к результатам поиска
    try {
      const s = ctx.wizard.state as { infoMessageIds?: number[] };
      const ids = Array.isArray(s?.infoMessageIds) ? [...s.infoMessageIds] : [];
      for (const id of ids) {
        try { await ctx.deleteMessage(id); } catch {}
      }
    } catch {}
    try { await ctx.reply('Ошибка при получении информации. Возвращаю к результатам поиска…'); } catch {}
    return ctx.scene.enter('search' as any, { resumeFromInfo: true });
  }

  const actionsMsg = await ctx.reply('Выберите действие:', {
    reply_markup: {
      inline_keyboard: [[
        { text: '◀️ Назад к результатам', callback_data: 'info_back' },
        { text: 'Новый поиск', callback_data: 'restart_search' }
      ]]
    }
  } as any);
  try {
    const mid = (actionsMsg as any)?.message_id;
    if (typeof mid === 'number') s.infoMessageIds.push(mid);
  } catch {}

  return ctx.wizard.next();
};

const infoStep2 = async (ctx: AnyContext) => {
  if (ctx.callbackQuery && 'data' in ctx.callbackQuery) {
    const data = (ctx.callbackQuery as any).data as string;
    await ctx.answerCbQuery();
    if (data === 'info_back') {
      const s = ctx.wizard.state as { brand?: string; number?: string; infoMessageIds?: number[] };
      const ids = Array.isArray(s.infoMessageIds) ? [...s.infoMessageIds] : [];
      for (const id of ids) {
        try { await ctx.deleteMessage(id); } catch {}
      }
      // Возвращаемся в сцену поиска без перерисовки результатов
      return ctx.scene.enter('search' as any, { resumeFromInfo: true });
    }
    if (data === 'restart_search') {
      return ctx.scene.enter('search');
    }
  }
};

const infoScene = new Scenes.WizardScene<AnyContext>(
  'info',
  infoStep1,
  infoStep2
);

export default infoScene;


