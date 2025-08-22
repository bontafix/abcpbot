import { Scenes } from 'telegraf';
import { OrderRepository, OrderRow } from '../repositories/orderRepository';
import { getMainMenuUser } from '../menu';

const ordersEnter = async (ctx: Scenes.WizardContext) => {
  const telegramId = ctx.from?.id ? String(ctx.from.id) : '';
  if (!telegramId) {
    await ctx.reply('Не удалось определить Telegram ID.');
    return ctx.scene.leave();
  }

  const list = await OrderRepository.getByTelegramId(telegramId);
  if (!Array.isArray(list) || list.length === 0) {
    await ctx.reply('У вас пока нет заказов.');
    return ctx.scene.leave();
  }

  for (const o of list as OrderRow[]) {
    const sum = (o.items || []).reduce((acc, it) => acc + Number(it.price || 0) * Number(it.count || 0), 0);
    const itemsText = (o.items || [])
      .map(it => `- ${it.title} (${it.number}) x${it.count} = ${Number(it.price).toFixed(2)}`)
      .join('\n');
    const msg =
      `Заказ #${o.id}\n` +
      `Статус: ${o.status ?? '-'}\n` +
      `Дата: ${new Date(o.datetime).toLocaleString()}\n` +
      (o.description ? `Комментарий: ${o.description}\n` : '') +
      `Имя: ${o.name}\n` +
      `Телефон: ${o.phone}\n` +
      `Позиции:\n${itemsText}\n` +
      `Итого: ${sum.toFixed(2)}`;
    await ctx.reply(msg, {
      reply_markup: {
        inline_keyboard: [[{ text: 'Удалить', callback_data: `order_delete:${o.id}` }]],
      },
    });
  }

  return ctx.wizard.next();
};

const ordersHandle = async (ctx: Scenes.WizardContext) => {
  if (!ctx.callbackQuery || !('data' in ctx.callbackQuery)) return;
  const data = (ctx.callbackQuery as any).data as string;
  if (!data.startsWith('order_delete:')) return;
  await ctx.answerCbQuery();
  const orderId = Number(data.split(':')[1]);
  const telegramId = ctx.from?.id ? String(ctx.from.id) : '';
  const res = await OrderRepository.deleteById(orderId, telegramId);
  try { await ctx.deleteMessage(); } catch (e) { /* ignore */ }
  await ctx.reply(res.message, await getMainMenuUser());
  return ctx.scene.leave();
};

const ordersScene = new Scenes.WizardScene<Scenes.WizardContext>(
  'orders',
  ordersEnter,
  ordersHandle
);

export default ordersScene;


