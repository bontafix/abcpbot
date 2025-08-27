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
  availabilityTransformed?: unknown;
  title?: string;
  price?: number;
  distributorId?: string;
  supplierCode?: string;
  lastUpdateTime?: string;
  contactName?: string;
  contactPhone?: string;
}

type ClientInfo = {
  name?: string;
  phone?: string;
  address?: string;
};

const orderStep1 = async (ctx: AnyContext) => {
  const s = ctx.wizard.state as OrderWizardState;
  const sceneState = (ctx.scene.state || {}) as { brand?: string; number?: string; availability?: number; availabilityTransformed?: unknown; title?: string; price?: number; distributorId?: string; supplierCode?: string; lastUpdateTime?: string };
  // Инициализируем из переданного state при enter
  s.brand = sceneState.brand;
  s.number = sceneState.number;
  s.availability = sceneState.availability;
  s.availabilityTransformed = sceneState.availabilityTransformed;
  s.title = sceneState.title;
  s.price = sceneState.price;
  s.distributorId = sceneState.distributorId;
  s.supplierCode = sceneState.supplierCode;
  s.lastUpdateTime = sceneState.lastUpdateTime;

  await ctx.reply(
    `Оформление заказа\nБрэнд: ${s.brand ?? '-'}\nАртикул: ${s.number ?? '-'}\nДоступно: ${String(s.availabilityTransformed ?? s.availability ?? '-')}` +
    `\n\nВведите количество:`,
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
    const availForCheck = s.availabilityTransformed;
    if (typeof availForCheck === 'number' && qty > availForCheck) {
      await ctx.reply(`Недостаточно на складе. Доступно: ${availForCheck}. Укажите количество не больше.`);
      return; // остаёмся на шаге 2
    }
    s.quantity = qty;

    await ctx.reply('Выберите способ доставки:', {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Самовывоз', callback_data: 'delivery:pickup' }],
          [{ text: 'Отправка Сдек', callback_data: 'delivery:delivery' }],
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
      const info = (Array.isArray(client) ? (client[0] as ClientInfo) : undefined);
      const savedName = info?.name ? String(info.name) : '';
      const savedPhone = info?.phone ? String(info.phone) : '';
      await ctx.reply(
        `Контактные данные для заказа:\nИмя: ${savedName || 'не указано'}\nТелефон: ${savedPhone || 'не указан'}\n\nИспользовать данные профиля или ввести другие?`,
        {
          reply_markup: {
            inline_keyboard: [
              [
                { text: 'Использовать профиль', callback_data: 'contact_use_saved' },
                { text: 'Изменить', callback_data: 'contact_change' }
              ]
            ]
          }
        }
      );
      // Переходим к шагу выбора контактов
      // @ts-ignore
      ctx.wizard.selectStep(4);
      return;
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
      const savedAddress = Array.isArray(client) ? String(client[0]?.address || '').trim() : '';
      if (savedAddress) {
        await ctx.reply(
          `Сохранённый адрес:
${savedAddress}
Использовать его или ввести новый?`,
          {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: 'Использовать сохранённый', callback_data: 'address_use_saved' },
                  { text: 'Изменить адрес', callback_data: 'address_change' },
                ],
              ],
            },
          }
        );
      } else {
        await ctx.reply('Введите адрес пункта Сдек:');
      }
      return ctx.wizard.next();
    }
  }

  await ctx.reply('Выберите вариант: Самовывоз или Отправка Сдек.');
};

const orderStep4 = async (ctx: AnyContext) => {
  const s = ctx.wizard.state as OrderWizardState;

  if (ctx.callbackQuery && 'data' in ctx.callbackQuery) {
    const data = (ctx.callbackQuery as any).data as string;
    await ctx.answerCbQuery();
    if (data === 'address_use_saved') {
      // Получаем сохранённый адрес и сразу оформляем
      const telegramId = ctx.from?.id ? String(ctx.from.id) : '';
      const { ClientRepository } = await import('../repositories/clientRepository');
      const client = telegramId ? await ClientRepository.get(telegramId) : [];
      const savedAddress = Array.isArray(client) ? String(client[0]?.address || '').trim() : '';
      if (!savedAddress) {
        await ctx.reply('Сохранённый адрес не найден. Введите адрес текстом:');
        return; // остаёмся на шаге 4 и ждём текст
      }
      s.address = savedAddress;
      // Переходим к выбору контактов
      const info = (Array.isArray(client) ? (client[0] as ClientInfo) : undefined);
      const savedName = info?.name ? String(info.name) : '';
      const savedPhone = info?.phone ? String(info.phone) : '';
      await ctx.reply(
        `Контактные данные для заказа:\nИмя: ${savedName || 'не указано'}\nТелефон: ${savedPhone || 'не указан'}\n\nИспользовать данные профиля или ввести другие?`,
        {
          reply_markup: {
            inline_keyboard: [
              [
                { text: 'Использовать профиль', callback_data: 'contact_use_saved' },
                { text: 'Изменить', callback_data: 'contact_change' }
              ]
            ]
          }
        }
      );
      // @ts-ignore
      ctx.wizard.selectStep(4);
      return;
    }
    if (data === 'address_change') {
      await ctx.reply('Введите новый адрес пункта Сдек:');
      return; // остаёмся на шаге 4, ждём текст
    }
  }

  if (ctx.message && 'text' in ctx.message) {
    const address = (ctx.message.text || '').trim();
    if (!address) {
      await ctx.reply('Пожалуйста, укажите адрес текстом.');
      return; // остаёмся на шаге 4
    }
    s.address = address;

    // Сохраним адрес в профиле и запросим контактные данные
    try {
      const telegramId = ctx.from?.id ? String(ctx.from.id) : '';
      if (telegramId) {
        const { ClientRepository } = await import('../repositories/clientRepository');
        await ClientRepository.update(telegramId, { address });
        const client = await ClientRepository.get(telegramId);
        const info = (Array.isArray(client) ? (client[0] as ClientInfo) : undefined);
        const savedName = info?.name ? String(info.name) : '';
        const savedPhone = info?.phone ? String(info.phone) : '';
        await ctx.reply(
          `Контактные данные для заказа:\nИмя: ${savedName || 'не указано'}\nТелефон: ${savedPhone || 'не указан'}\n\nИспользовать данные профиля или ввести другие?`,
          {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: 'Использовать профиль', callback_data: 'contact_use_saved' },
                  { text: 'Изменить', callback_data: 'contact_change' }
                ]
              ]
            }
          }
        );
      }
    } catch (e) { /* noop */ }

    // @ts-ignore
    ctx.wizard.selectStep(4);
    return;
  }

  await ctx.reply('Введите адрес текстом.');
};

const orderStep5 = async (ctx: AnyContext) => {
  const s = ctx.wizard.state as OrderWizardState;

  if (ctx.callbackQuery && 'data' in ctx.callbackQuery) {
    const data = (ctx.callbackQuery as any).data as string;
    await ctx.answerCbQuery();

    if (data === 'contact_use_saved') {
      const telegramId = ctx.from?.id ? String(ctx.from.id) : '';
      const { ClientRepository } = await import('../repositories/clientRepository');
      const client = telegramId ? await ClientRepository.get(telegramId) : [];
      const name = Array.isArray(client) && client[0]?.name ? String(client[0].name) : '';
      const phone = Array.isArray(client) && client[0]?.phone ? String(client[0].phone) : '';
      if (!name || !phone) {
        await ctx.reply('В профиле не найдены имя и/или телефон. Введите их текстом через перенос строки:\nИмя\n+79990000000');
        return; // остаёмся на шаге 5
      }
      s.contactName = name;
      s.contactPhone = phone;

      // Сохраняем заказ
      try {
        if ((ctx.from?.id) && s.number && s.title && s.quantity && typeof s.price === 'number') {
          const telegramId2 = String(ctx.from.id);
          const { OrderRepository } = await import('../repositories/orderRepository');
          const deliveryText = s.deliveryMethod === 'pickup' ? 'Самовывоз' : `Доставка: пункт Сдек:${s.address || ''}`;
          await OrderRepository.create(telegramId2, [
            { number: String(s.number), title: String(s.title), count: Number(s.quantity), price: Number(s.price), brand: String(s.brand || ''), distributorId: String(s.distributorId || ''), supplierCode: String(s.supplierCode || ''), lastUpdateTime: String(s.lastUpdateTime || '') }
          ], deliveryText, String(s.contactName || ''), String(s.contactPhone || ''));
        }
      } catch (e) { /* noop */ }

      await ctx.reply(`Заказ принят:\nБрэнд: ${s.brand}\nАртикул: ${s.number}\nКоличество: ${s.quantity}\nИмя: ${s.contactName}\nТелефон: ${s.contactPhone}\nДоставка: ${s.deliveryMethod === 'pickup' ? 'Самовывоз' : `Адрес\n${s.address}`}`);
      return ctx.scene.enter('search' as any);
    }

    if (data === 'contact_change') {
      await ctx.reply('Отправьте имя и телефон через перенос строки:\nИмя\n+79990000000');
      return; // остаёмся на шаге 5
    }

    if (data === 'contact_save_yes') {
      // Сохраняем контакты в профиль и оформляем заказ
      try {
        const telegramId = ctx.from?.id ? String(ctx.from.id) : '';
        if (telegramId && s.contactName && s.contactPhone) {
          const { ClientRepository } = await import('../repositories/clientRepository');
          await ClientRepository.update(telegramId, { name: s.contactName, phone: s.contactPhone });
        }
      } catch (e) { /* noop */ }

      try {
        if ((ctx.from?.id) && s.number && s.title && s.quantity && typeof s.price === 'number') {
          const telegramId = String(ctx.from.id);
          const { OrderRepository } = await import('../repositories/orderRepository');
          const deliveryText = s.deliveryMethod === 'pickup' ? 'Самовывоз' : `Доставка: пункт Сдек:${s.address || ''}`;
          await OrderRepository.create(telegramId, [
            { number: String(s.number), title: String(s.title), count: Number(s.quantity), price: Number(s.price), brand: String(s.brand || ''), distributorId: String(s.distributorId || ''), supplierCode: String(s.supplierCode || ''), lastUpdateTime: String(s.lastUpdateTime || '') }
          ], deliveryText, String(s.contactName || ''), String(s.contactPhone || ''));
        }
      } catch (e) { /* noop */ }

      await ctx.reply(`Заказ принят:\nБрэнд: ${s.brand}\nАртикул: ${s.number}\nКоличество: ${s.quantity}\nИмя: ${s.contactName}\nТелефон: ${s.contactPhone}\nДоставка: ${s.deliveryMethod === 'pickup' ? 'Самовывоз' : `Адрес\n${s.address}`}`);
      return ctx.scene.enter('search' as any);
    }

    if (data === 'contact_save_no') {
      // Оформляем заказ без сохранения в профиль
      try {
        if ((ctx.from?.id) && s.number && s.title && s.quantity && typeof s.price === 'number') {
          const telegramId = String(ctx.from.id);
          const { OrderRepository } = await import('../repositories/orderRepository');
          const deliveryText = s.deliveryMethod === 'pickup' ? 'Самовывоз' : `Доставка: пункт Сдек:${s.address || ''}`;
          await OrderRepository.create(telegramId, [
            { number: String(s.number), title: String(s.title), count: Number(s.quantity), price: Number(s.price), brand: String(s.brand || ''), distributorId: String(s.distributorId || ''), supplierCode: String(s.supplierCode || ''), lastUpdateTime: String(s.lastUpdateTime || '') }
          ], deliveryText, String(s.contactName || ''), String(s.contactPhone || ''));
        }
      } catch (e) { /* noop */ }

      await ctx.reply(`Заказ принят:\nБрэнд: ${s.brand}\nАртикул: ${s.number}\nКоличество: ${s.quantity}\nИмя: ${s.contactName}\nТелефон: ${s.contactPhone}\nДоставка: ${s.deliveryMethod === 'pickup' ? 'Самовывоз' : `Адрес\n${s.address}`}`);
      return ctx.scene.enter('search' as any);
    }
  }

  if (ctx.message && 'text' in ctx.message) {
    const raw = (ctx.message.text || '').trim();
    const parts = raw.split('\n').map((v) => v.trim()).filter(Boolean);
    if (parts.length < 2) {
      await ctx.reply('Некорректный формат. Отправьте имя и телефон через перенос строки:\nИмя\n+79990000000');
      return; // остаёмся на шаге 5
    }
    const [name, phone] = parts;
    s.contactName = name;
    s.contactPhone = phone;

    // Предложим сохранить новые данные в профиль
    await ctx.reply(
      'Сохранить эти контактные данные в профиле?',
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: 'Да, сохранить', callback_data: 'contact_save_yes' },
              { text: 'Нет', callback_data: 'contact_save_no' }
            ]
          ]
        }
      }
    );
    return; // остаёмся на шаге 5, ждём выбор
  }

  await ctx.reply('Отправьте имя и телефон через перенос строки:\nИмя\n+79990000000');
};

const orderScene = new Scenes.WizardScene<AnyContext>(
  'order',
  orderStep1,
  orderStep2,
  orderStep3,
  orderStep4,
  orderStep5
);

export default orderScene;
