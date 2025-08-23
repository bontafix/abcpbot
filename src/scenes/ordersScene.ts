import { Scenes, Markup } from 'telegraf';
import { OrderRepository, OrderRow } from '../repositories/orderRepository';
import { getMainMenuUser } from '../menu';

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

const ordersEnter = async (ctx: Scenes.WizardContext) => {
  const s = ctx.wizard.state as { orderMessageIds?: number[] };
  // Инициализируем хранилище id сообщений с заказами
  s.orderMessageIds = [];
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

  const state = (ctx.scene.state || {}) as { filterStatus?: string };
  const normalized = state.filterStatus ? String(state.filterStatus).toLowerCase() : '';
  const filtered = normalized ? (list as OrderRow[]).filter(o => String(o.status || '').toLowerCase() === normalized) : (list as OrderRow[]);

  if (filtered.length === 0 && normalized) {
    const label = STATUS_LABELS[normalized] || normalized;
    await ctx.reply(`Заказов в статусе «${label}» нет.`);
    await ctx.reply('Выберите статус:', Markup.keyboard([
      ['Новый', 'В работе'],
      ['В резерве', 'Выполнен'],
      ['Отказ'],
      ['Назад']
    ]).resize());
    return ctx.wizard.next();
  }

  for (const o of filtered as OrderRow[]) {
    const sum = (o.items || []).reduce((acc, it) => acc + Number(it.price || 0) * Number(it.count || 0), 0);
    const itemsText = (o.items || [])
      .map(it => `${it.number} ${it.title} ${Number(it.count)} ${Number(it.price).toFixed(2)} ${(Number(it.price) * Number(it.count)).toFixed(2)}`)
      .join('\n');
    const statusLabel = STATUS_LABELS[String(o.status || '').toLowerCase()] || (o.status ?? '-');
    const msg =
      `Заказ #${o.id} • ${new Date(o.datetime).toLocaleString()}\n` +
      `Статус: ${statusLabel}\n` +
      (o.description ? `💬 ${o.description}\n` : '') +
      `${itemsText}\n` +
      `Итого: ${sum.toFixed(2)}`;
    const actionButtons: Array<{ text: string; callback_data: string }> = [];
    // Разрешаем удаление только в статусе 'rejected'
    if (String(o.status || '').toLowerCase() === 'rejected') {
      actionButtons.push({ text: 'Удалить', callback_data: `order_delete:${o.id}` });
    } else if (String(o.status || '').toLowerCase() !== 'completed') {
      // Для незавершённых — кнопка отказа
      actionButtons.push({ text: 'Отказаться', callback_data: `order_cancel:${o.id}` });
    }

    const sent = await ctx.reply(msg, {
      reply_markup: actionButtons.length
        ? { inline_keyboard: [actionButtons] }
        : undefined,
    });
    try {
      const mid = (sent as any)?.message_id;
      if (typeof mid === 'number') {
        s.orderMessageIds!.push(mid);
      }
    } catch {}
  }

  await ctx.reply('Выберите статус:', Markup.keyboard([
    ['Новый', 'В работе'],
    ['В резерве', 'Выполнен'],
    ['Отказ'],
    ['Назад']
  ]).resize());

  return ctx.wizard.next();
};

const ordersHandle = async (ctx: Scenes.WizardContext) => {
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
      // Удаляем ранее отправленные сообщения с заказами, если они были сохранены
      const s = ctx.wizard.state as { orderMessageIds?: number[] };
      const ids = Array.isArray(s.orderMessageIds) ? [...s.orderMessageIds] : [];
      for (const id of ids) {
        try { await ctx.deleteMessage(id); } catch {}
      }
      s.orderMessageIds = [];
      return ctx.scene.enter('orders', { filterStatus: mapped });
    }
    return; // игнорируем прочее
  }

  if (ctx.callbackQuery && 'data' in ctx.callbackQuery) {
    const data = (ctx.callbackQuery as any).data as string;
    if (data.startsWith('order_delete:')) {
      await ctx.answerCbQuery();
      const orderId = Number(data.split(':')[1]);
      const telegramId = ctx.from?.id ? String(ctx.from.id) : '';
      const res = await OrderRepository.deleteById(orderId, telegramId);
      try { await ctx.deleteMessage(); } catch (e) { /* ignore */ }
      await ctx.reply(res.message, await getMainMenuUser());
      return ctx.scene.leave();
    }
    if (data.startsWith('order_cancel:')) {
      await ctx.answerCbQuery();
      const orderId = Number(data.split(':')[1]);
      const telegramId = ctx.from?.id ? String(ctx.from.id) : '';
      const res = await OrderRepository.updateStatusByTelegram(orderId, telegramId, 'rejected');
      try { await ctx.deleteMessage(); } catch (e) { /* ignore */ }
      await ctx.reply(res.message);
      return; // остаёмся в сцене; пользователь может выбрать статус снова
    }
  }
};

const ordersScene = new Scenes.WizardScene<Scenes.WizardContext>(
  'orders',
  ordersEnter,
  ordersHandle
);

export default ordersScene;


