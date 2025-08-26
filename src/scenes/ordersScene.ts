import { Scenes, Markup } from 'telegraf';
import { OrderRepository, OrderRow } from '../repositories/orderRepository';
import { getMainMenuUser } from '../menu';
import { generatePdf } from '../invoice/service';
import { ClientRepository } from '../repositories/clientRepository';
import * as path from 'path';

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
    // Кнопка выписки счёта доступна для любого заказа
    actionButtons.push({ text: 'Выписать счёт', callback_data: `order_invoice:${o.id}` });

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
    if (data.startsWith('order_invoice:')) {
      await ctx.answerCbQuery('Генерирую счёт…');
      const orderId = Number(data.split(':')[1]);
      const telegramId = ctx.from?.id ? String(ctx.from.id) : '';
      try {
        // Ищем заказ пользователя
        const list = await OrderRepository.getByTelegramId(telegramId);
        if (!Array.isArray(list)) {
          await ctx.reply('Не удалось получить список ваших заказов.');
          return;
        }
        const order = (list as OrderRow[]).find(o => Number(o.id) === orderId);
        if (!order) {
          await ctx.reply(`Заказ #${orderId} не найден.`);
          return;
        }

        // Проверяем реквизиты поставщика из окружения
        const supplier = {
          title: process.env.SUPPLIER_TITLE || '',
          rs: process.env.SUPPLIER_RS || '',
          bik: process.env.SUPPLIER_BIK || '',
          ks: process.env.SUPPLIER_KS || '',
          inn: process.env.SUPPLIER_INN || '',
          ogrn: process.env.SUPPLIER_OGRN || '',
          kpp: process.env.SUPPLIER_KPP || '',
          bank: process.env.SUPPLIER_BANK || '',
        };
        if (!supplier.title || !supplier.rs || !supplier.bik || !supplier.ks || !supplier.inn) {
          await ctx.reply('Реквизиты поставщика не настроены. Обратитесь к администратору.');
          return;
        }

        const sum = (order.items || []).reduce((acc, it) => acc + Number(it.price || 0) * Number(it.count || 0), 0);
        const pad2 = (n: number) => (n < 10 ? `0${n}` : String(n));
        const now = new Date();
        const date = `${pad2(now.getDate())}.${pad2(now.getMonth() + 1)}.${now.getFullYear()}`;
        const invoiceNumber = `INV-${orderId}`;

        // Получаем реквизиты клиента для подстановки в customer
        const clientRow = await ClientRepository.get(telegramId);
        const clientInfo = Array.isArray(clientRow) && clientRow.length ? (clientRow as any)[0] : undefined;
        const customer = clientInfo ? {
          title: String(clientInfo.org_title || clientInfo.name || '').trim(),
          inn: String(clientInfo.org_inn || '').trim(),
          ogrn: String(clientInfo.org_ogrn || '').trim(),
          address: String(clientInfo.org_address || clientInfo.address || '').trim(),
          phone: String(order.phone || '').trim()
        } : { title: order.name, inn: '', address: '', phone: String(order.phone || '').trim() };

        // Готовим позиции счёта из заказа
        const items = (order.items || []).map((it: any) => {
          const quantity = Number(it.count ?? it.quantity ?? 1);
          const price = Number(it.price ?? 0);
          return {
            name: String(` ${it.brand} ${it.number} ${it.title}`).trim(),
            unit: String(it.unit ?? 'шт.'),
            tax: String(it.tax ?? 'без НДС'),
            price,
            quantity,
            total: Number(price * quantity),
          };
        });

        const invoiceData: any = {
          supplier,
          customer,
          items,
          sum: Number(sum.toFixed(2)),
          sumStr: sum.toFixed(2),
          itemsCount: items.length,
          comment: `Оплата по заказу #${orderId}`,
          number: invoiceNumber,
          date,
        };

        const result = await generatePdf(invoiceData);
        if (result && result.url) {
          // Пробуем отправить PDF как документ
          try {
            const baseDir = process.env.PATH_OUTPUT_STATIC || '';
            const filePath = path.isAbsolute(baseDir)
              ? path.join(baseDir, result.file)
              : path.join(process.cwd(), baseDir, result.file);
            await ctx.replyWithDocument({ source: filePath, filename: result.file });
          } catch {
            // Если не получилось, отправим ссылку
            await ctx.reply(`Счёт готов: ${result.url}`);
          }
        } else {
          await ctx.reply('Не удалось сгенерировать счёт. Попробуйте позже.');
        }
      } catch (e) {
        await ctx.reply('Произошла ошибка при генерации счёта. Попробуйте позже.');
      }
      return;
    }
  }
};

const ordersScene = new Scenes.WizardScene<Scenes.WizardContext>(
  'orders',
  ordersEnter,
  ordersHandle
);

export default ordersScene;


