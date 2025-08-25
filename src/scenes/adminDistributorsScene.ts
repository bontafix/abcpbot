import { Scenes } from 'telegraf';
import { getDistributors } from '../abcp';

type AnyContext = Scenes.WizardContext & { scene: any; wizard: any };

interface AdminDistributorsState {
  page?: number;
  pageSize?: number;
}

function buildKeyboard(page: number, totalPages: number) {
  const prev = page > 1 ? [{ text: '« Назад', callback_data: 'page:prev' }] : [];
  const next = page < totalPages ? [{ text: 'Вперёд »', callback_data: 'page:next' }] : [];
  const first = page !== 1 ? [{ text: '⏮ В начало', callback_data: 'page:first' }] : [];
  const last = page !== totalPages ? [{ text: 'В конец ⏭', callback_data: 'page:last' }] : [];
  const navRow = [...first, ...prev, { text: `${page}/${totalPages}`, callback_data: 'noop' }, ...next, ...last];
  return { inline_keyboard: [navRow, [{ text: '⬅️ В админку', callback_data: 'back:admin' }]] } as any;
}

async function replyPage(ctx: AnyContext) {
  const s = ctx.wizard.state as AdminDistributorsState;
  const pageSize = Math.max(1, Math.min(50, Number(s.pageSize ?? 10)));
  const page = Math.max(1, Number(s.page ?? 1));
  s.page = page;
  
  try {
    const distributors = await getDistributors();
    
    if (!distributors || distributors.length === 0) {
      await ctx.reply('Нет поставщиков.', { 
        reply_markup: { inline_keyboard: [[{ text: '⬅️ В админку', callback_data: 'back:admin' }]] } as any 
      });
      return;
    }

    const total = distributors.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const currentPage = Math.max(1, Math.min(page, totalPages));
    s.page = currentPage;
    
    const offset = (currentPage - 1) * pageSize;
    const pageDistributors = distributors.slice(offset, offset + pageSize);

    const lines = pageDistributors.map((d: any) => {
      const positionsNumber = d.positionsNumber || '-';
      const isEnabled = d.isEnabled ? '●' : '○';
      const name = d.name || d.title || 'Без названия';
      const id = d.id || 'N/A';
      const updateTime = d.updateTime || '---';
  
      let line = `${isEnabled} #${id} • [${updateTime}] • ${name} • (${positionsNumber})`;
     
      
      return line;
    });

    const header = `Поставщиков: ${total}. Стр. ${currentPage}/${totalPages}.`;
    const text = [header, '', ...lines].join('\n');
    
    await ctx.reply(text, { 
      reply_markup: buildKeyboard(currentPage, totalPages) 
    } as any);
    
  } catch (error) {
    console.error('Ошибка при получении поставщиков:', error);
    await ctx.reply('Ошибка при получении списка поставщиков.', { 
      reply_markup: { inline_keyboard: [[{ text: '⬅️ В админку', callback_data: 'back:admin' }]] } as any 
    });
  }
}

const adminDistributorsEnter = async (ctx: AnyContext) => {
  const s = ctx.wizard.state as AdminDistributorsState;
  s.page = 1;
  s.pageSize = 10;
  await replyPage(ctx);
  return ctx.wizard.next();
};

const adminDistributorsStep = async (ctx: AnyContext) => {
  if (ctx.callbackQuery && 'data' in ctx.callbackQuery) {
    const data = (ctx.callbackQuery as any).data as string;
    await ctx.answerCbQuery();
    
    // Обработка кнопки "В админку" должна быть первой и без try-catch
    if (data === 'back:admin') {
      console.log('Переход в админ сцену из поставщиков');
      try {
        await ctx.scene.leave();
        await ctx.reply('Возврат в админ-панель...');
        // @ts-ignore
        return ctx.scene.enter('admin_scene');
      } catch (error) {
        console.error('Ошибка при переходе в админ сцену:', error);
        await ctx.reply('Ошибка при переходе. Попробуйте команду /admin');
      }
      return;
    }
    
    const s = ctx.wizard.state as AdminDistributorsState;
    
    try {
      const distributors = await getDistributors();
      const total = distributors?.length || 0;
      const totalPages = Math.max(1, Math.ceil(total / Math.max(1, Math.min(50, Number(s.pageSize ?? 10)))));
      const current = Math.max(1, Math.min(Number(s.page ?? 1), totalPages));

      if (data === 'page:prev') {
        s.page = Math.max(1, current - 1);
        return replyPage(ctx);
      }
      if (data === 'page:next') {
        s.page = Math.min(totalPages, current + 1);
        return replyPage(ctx);
      }
      if (data === 'page:first') {
        s.page = 1;
        return replyPage(ctx);
      }
      if (data === 'page:last') {
        s.page = totalPages;
        return replyPage(ctx);
      }
    } catch (error) {
      console.error('Ошибка при обработке действия:', error);
      await ctx.reply('Произошла ошибка. Попробуйте снова.', { 
        reply_markup: { inline_keyboard: [[{ text: '⬅️ В админку', callback_data: 'back:admin' }]] } as any 
      });
    }
  }
};

const adminDistributorsScene = new Scenes.WizardScene<AnyContext>('admin_distributors', adminDistributorsEnter, adminDistributorsStep);

export default adminDistributorsScene;


