import { Scenes } from 'telegraf';
import { ClientRepository } from '../repositories/clientRepository';

type AnyContext = Scenes.WizardContext & { scene: any; wizard: any };

interface AdminClientsState {
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
  const s = ctx.wizard.state as AdminClientsState;
  const pageSize = Math.max(1, Math.min(50, Number(s.pageSize ?? 10)));
  const total = await ClientRepository.count();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.max(1, Math.min(Number(s.page ?? 1), totalPages));
  s.page = page;
  const offset = (page - 1) * pageSize;
  const rows = await ClientRepository.list(pageSize, offset);

  // const lines_ = rows.map((c) => `#${c.id} • ${c.name} • ${c.phone}\n${c.telegram_id}${c.address ? `\n${c.address}` : ''}`);
  const lines = rows.map((c) => `#${c.id} • ${c.name} • ${c.phone}`);
  const header = `Клиентов: ${total}. Стр. ${page}/${totalPages}.`;
  const text = [header, '', ...lines].join('\n');
  await ctx.reply(text || 'Нет клиентов.', { reply_markup: buildKeyboard(page, totalPages) } as any);
}

const adminClientsEnter = async (ctx: AnyContext) => {
  const s = ctx.wizard.state as AdminClientsState;
  s.page = 1;
  s.pageSize = 10;
  await replyPage(ctx);
  return ctx.wizard.next();
};

const adminClientsStep = async (ctx: AnyContext) => {
  if (ctx.callbackQuery && 'data' in ctx.callbackQuery) {
    const data = (ctx.callbackQuery as any).data as string;
    await ctx.answerCbQuery();
    const s = ctx.wizard.state as AdminClientsState;
    const total = await ClientRepository.count();
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
    if (data === 'back:admin') {
      // console.log('Переход в админ сцену из клиентов');
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
  }
};

const adminClientsScene = new Scenes.WizardScene<AnyContext>('admin_clients', adminClientsEnter, adminClientsStep);

export default adminClientsScene;


