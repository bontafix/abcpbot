import { Scenes, Markup } from 'telegraf';
import { OrderRepository } from '../repositories/orderRepository';
import { getMainMenuUser } from '../menu';

type AnyContext = Scenes.WizardContext & { scene: any; wizard: any };

const STATUS_LABELS: Record<string, string> = {
  new: 'Новый',
  in_progress: 'В работе',
  rejected: 'Отказ',
  completed: 'Выполнен',
  reserved: 'В резерве',
};

const STATUS_ORDER: Array<keyof typeof STATUS_LABELS> = [
  'new',
  'in_progress',
  'reserved',
  'completed',
  'rejected',
];

const ordersSummaryEnter = async (ctx: AnyContext) => {
  const telegramId = ctx.from?.id ? String(ctx.from.id) : '';
  if (!telegramId) {
    await ctx.reply('Не удалось определить Telegram ID.');
    return ctx.scene.leave();
  }

  const orders = await OrderRepository.getByTelegramId(telegramId);
  if (!Array.isArray(orders) || orders.length === 0) {
    await ctx.reply('У вас пока нет заказов.', await getMainMenuUser());
    return ctx.scene.leave();
  }

  const counts: Record<string, number> = {};
  for (const key of Object.keys(STATUS_LABELS)) counts[key] = 0;
  for (const o of orders) {
    const k = String(o.status || '').toLowerCase();
    if (counts[k] === undefined) counts[k] = 0;
    counts[k]++;
  }

  const lines: string[] = [];
  for (const key of STATUS_ORDER) {
    const label = STATUS_LABELS[key];
    const n = counts[key] || 0;
    lines.push(`${label}: ${n}`);
  }

  await ctx.reply(
    `Ваши заказы по статусам:\n${lines.join('\n')}\n\nВыберите, какие заказы показать:`,
    Markup.keyboard([
      ['Новый', 'В работе'],
      ['В резерве', 'Выполнен'],
      ['Отказ'],
      ['Назад']
    ]).resize()
  );

  return ctx.wizard.next();
};

const ordersSummaryHandle = async (ctx: AnyContext) => {
  if (ctx.message && 'text' in ctx.message) {
    const txt = (ctx.message.text || '').trim();
    if (txt === 'Назад') {
      await ctx.reply('Скрываю клавиатуру…', Markup.removeKeyboard());
      await ctx.reply('Меню', await getMainMenuUser());
      return ctx.scene.leave();
    }
    const labelToKey: Record<string, string> = {
      'Новый': 'new',
      'В работе': 'in_progress',
      'Отказ': 'rejected',
      'Выполнен': 'completed',
      'В резерве': 'reserved',
    };
    const mapped = labelToKey[txt] || '';
    if (mapped) {
      // При переходе в orders удалим предыдущее summary-сообщение (если возможно)
      try { await ctx.deleteMessage(); } catch {}
      return ctx.scene.enter('orders', { filterStatus: mapped });
    }
    return; // игнорируем прочее
  }
};

const ordersSummaryScene = new Scenes.WizardScene<AnyContext>(
  'orders_summary',
  ordersSummaryEnter,
  ordersSummaryHandle
);

export default ordersSummaryScene;


