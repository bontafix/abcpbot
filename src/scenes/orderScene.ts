import { Scenes } from 'telegraf';

// Универсальный контекст для совместимости
type AnyContext = Scenes.WizardContext & { scene: any; wizard: any };

interface OrderWizardState {
  brand?: string;
  number?: string;
  quantity?: number;
  deliveryMethod?: 'pickup' | 'delivery';
  address?: string;
  availability?: number;
  title?: string;
  price?: number;
  distributorId?: string;
  supplierCode?: string;
  lastUpdateTime?: string;
}

const orderStep1 = async (ctx: AnyContext) => {
  const s = ctx.wizard.state as OrderWizardState;
  const sceneState = (ctx.scene.state || {}) as { brand?: string; number?: string; availability?: number; title?: string; price?: number; distributorId?: string; supplierCode?: string; lastUpdateTime?: string };
  // Инициализируем из переданного state при enter
  s.brand = sceneState.brand;
  s.number = sceneState.number;
  s.availability = sceneState.availability;
  s.title = sceneState.title;
  s.price = sceneState.price;
  s.distributorId = sceneState.distributorId;
  s.supplierCode = sceneState.supplierCode;
  s.lastUpdateTime = sceneState.lastUpdateTime;

  await ctx.reply(
    `Оформление заказа\nБрэнд: ${s.brand ?? '-'}\nАртикул: ${s.number ?? '-'}\nДоступно: ${s.availability ?? '-'}\n\nВведите количество:`,
    {
      reply_markup: {
        inline_keyboard: [[{ text: 'Отмена', callback_data: 'cancel_order' }]],
      },
    }
  );
  return ctx.wizard.next();
};

const orderStep2 = async (ctx: AnyContext) => {
  const s = ctx.wizard.state as OrderWizardState;

  // Обработка отмены через кнопку
  if (ctx.callbackQuery && 'data' in ctx.callbackQuery) {
    const data = (ctx.callbackQuery as any).data as string;
    if (data === 'cancel_order') {
      await ctx.answerCbQuery('Отменено');
      try { await ctx.deleteMessage(); } catch (e) { /* ignore */ }
      const s2 = ctx.wizard.state as OrderWizardState;
      // Переходим обратно в сцену поиска и передаём бренд/номер для повторного показа предложений
      return ctx.scene.enter('search' as any, { resumeBrand: s2.brand, resumeNumber: s2.number });
    }
  }

  if (ctx.message && 'text' in ctx.message) {
    const qtyRaw = (ctx.message.text || '').trim();
    const qty = Number(qtyRaw);
    if (!Number.isFinite(qty) || qty <= 0) {
      await ctx.reply('Укажите корректное положительное число.');
      return; // остаёмся на шаге 2
    }
    if (typeof s.availability === 'number' && qty > s.availability) {
      await ctx.reply(`Недостаточно на складе. Доступно: ${s.availability}. Укажите количество не больше.`);
      return; // остаёмся на шаге 2
    }
    s.quantity = qty;

    await ctx.reply('Выберите способ доставки:', {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Самовывоз', callback_data: 'delivery:pickup' }],
          [{ text: 'Доставка', callback_data: 'delivery:delivery' }],
        ],
      },
    });
    return ctx.wizard.next();
  }

  await ctx.reply('Введите количество числом.');
};

const orderStep3 = async (ctx: AnyContext) => {
  const s = ctx.wizard.state as OrderWizardState;

  if (ctx.callbackQuery && 'data' in ctx.callbackQuery) {
    const data = (ctx.callbackQuery as any).data as string;
    await ctx.answerCbQuery();

    if (data === 'delivery:pickup') {
      s.deliveryMethod = 'pickup';
      // Проверка регистрации
      const telegramId = ctx.from?.id ? String(ctx.from.id) : '';
      const { ClientRepository } = await import('../repositories/clientRepository');
      const client = telegramId ? await ClientRepository.get(telegramId) : [];
      if (!Array.isArray(client) || client.length === 0) {
        await ctx.reply('Перед оформлением нужно зарегистрироваться.');
        // Переход в регистрацию с возвратом обратно в order
        // @ts-ignore
        return ctx.scene.enter('registration', { afterScene: 'order', afterState: { brand: s.brand, number: s.number, availability: s.availability } });
      }
      // Сохранение заказа
      try {
        const telegramId = ctx.from?.id ? String(ctx.from.id) : '';
        if (telegramId && s.number && s.title && s.quantity && typeof s.price === 'number') {
          const { OrderRepository } = await import('../repositories/orderRepository');
          const { ClientRepository } = await import('../repositories/clientRepository');
          const client = await ClientRepository.get(telegramId);
          const name = Array.isArray(client) && client[0]?.name ? String(client[0].name) : '';
          const phone = Array.isArray(client) && client[0]?.phone ? String(client[0].phone) : '';
          await OrderRepository.create(telegramId, [
            { number: String(s.number), title: String(s.title), count: Number(s.quantity), price: Number(s.price), brand: String(s.brand || ''), distributorId: String(s.distributorId || ''), supplierCode: String(s.supplierCode || ''), lastUpdateTime: String(s.lastUpdateTime || '') }
          ], `Доставка: Самовывоз`, name, phone);
        }
      } catch (e) { /* noop */ }

      await ctx.reply(`Заказ принят:\nБрэнд: ${s.brand}\nАртикул: ${s.number}\nКоличество: ${s.quantity}\nДоставка: Самовывоз`);
      return ctx.scene.leave();
    }

    if (data === 'delivery:delivery') {
      s.deliveryMethod = 'delivery';
      // Проверка регистрации
      const telegramId = ctx.from?.id ? String(ctx.from.id) : '';
      const { ClientRepository } = await import('../repositories/clientRepository');
      const client = telegramId ? await ClientRepository.get(telegramId) : [];
      if (!Array.isArray(client) || client.length === 0) {
        await ctx.reply('Перед оформлением нужно зарегистрироваться.');
        // Переход в регистрацию с возвратом обратно в order
        // @ts-ignore
        return ctx.scene.enter('registration', { afterScene: 'order', afterState: { brand: s.brand, number: s.number, availability: s.availability } });
      }
      await ctx.reply('Введите адрес доставки:');
      return ctx.wizard.next();
    }
  }

  await ctx.reply('Выберите вариант: Самовывоз или Доставка.');
};

const orderStep4 = async (ctx: AnyContext) => {
  const s = ctx.wizard.state as OrderWizardState;

  if (ctx.message && 'text' in ctx.message) {
    const address = (ctx.message.text || '').trim();
    if (!address) {
      await ctx.reply('Пожалуйста, укажите адрес текстом.');
      return; // остаёмся на шаге 4
    }
    s.address = address;

    // Сохранение заказа
    try {
      const telegramId = ctx.from?.id ? String(ctx.from.id) : '';
      if (telegramId && s.number && s.title && s.quantity && typeof s.price === 'number') {
        const { OrderRepository } = await import('../repositories/orderRepository');
        const { ClientRepository } = await import('../repositories/clientRepository');
        const client = await ClientRepository.get(telegramId);
        const name = Array.isArray(client) && client[0]?.name ? String(client[0].name) : '';
        const phone = Array.isArray(client) && client[0]?.phone ? String(client[0].phone) : '';
        await OrderRepository.create(telegramId, [
          { number: String(s.number), title: String(s.title), count: Number(s.quantity), price: Number(s.price), brand: String(s.brand || ''), distributorId: String(s.distributorId || ''), supplierCode: String(s.supplierCode || ''), lastUpdateTime: String(s.lastUpdateTime || '') }
        ], `Доставка: Адрес ${address}`, name, phone);
      }
    } catch (e) { /* noop */ }

    await ctx.reply(`Заказ принят:\nБрэнд: ${s.brand}\nАртикул: ${s.number}\nКоличество: ${s.quantity}\nДоставка: Адрес\n${s.address}`);
    return ctx.scene.leave();
  }

  await ctx.reply('Введите адрес текстом.');
};

const orderScene = new Scenes.WizardScene<AnyContext>(
  'order',
  orderStep1,
  orderStep2,
  orderStep3,
  orderStep4
);

export default orderScene;
