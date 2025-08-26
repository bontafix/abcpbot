import { Scenes, Markup } from 'telegraf';
import { ClientRepository } from '../repositories/clientRepository';
import { getMainMenuUser, getMainMenuGuest } from '../menu';

const profileEnter = async (ctx: Scenes.WizardContext) => {
  const telegramId = ctx.from?.id ? String(ctx.from.id) : '';
  if (!telegramId) {
    await ctx.reply('Не удалось определить Telegram ID.');
    return ctx.scene.leave();
  }
  const client = await ClientRepository.get(telegramId);
  if (!Array.isArray(client) || client.length === 0) {
    await ctx.reply('Вы не зарегистрированы. Нажмите «Регистрация» в меню.');
    return ctx.scene.leave();
  }
  const info = client[0];
  await ctx.reply(
    `Ваш профиль:\nИмя: ${info.name}\nТелефон: ${info.phone}\nАдрес Сдек: ${String(info.address || '').trim() || 'не указан'}\n\nРеквизиты организации:\nИНН: ${String((info as any).org_inn || '').trim() || 'не указан'}\nНаименование: ${String((info as any).org_title || '').trim() || 'не указано'}\nОГРН: ${String((info as any).org_ogrn || '').trim() || 'не указан'}\nЮр.адрес: ${String((info as any).org_address || '').trim() || 'не указан'}`,
    Markup.keyboard([
      [ 'Редактировать', 'Удалить' ],
      [ 'Редактировать реквизиты' ],
      [ 'Изменить Адрес отправки Сдек' ],
      [ 'Назад' ]
    ]).resize()
  );
  return ctx.wizard.next();
};

const profileHandle = async (ctx: Scenes.WizardContext) => {
  if (!ctx.message || !('text' in ctx.message)) return;
  const text = ctx.message.text;
  const telegramId = ctx.from?.id ? String(ctx.from.id) : '';

  if (text === 'Удалить') {
    const client = await ClientRepository.get(telegramId);
    if (!Array.isArray(client) || client.length === 0) {
      await ctx.reply('Профиль не найден.');
      return ctx.scene.leave();
    }
    const info = client[0];
    await ctx.reply(
      `Вы собираетесь удалить профиль:\nИмя: ${info.name}\nТелефон: ${info.phone}\n\nУдалить заказы и историю поиска вместе с профилем?`,
      Markup.keyboard([[ 'Удалить всё', 'Удалить только профиль' ], [ 'Отмена', 'Назад' ]]).resize()
    );
    // Переходим на шаг подтверждения удаления
    // @ts-ignore
    ctx.wizard.selectStep(4);
    return;
  }

  if (text === 'Редактировать') {
    await ctx.reply(
      'Отправьте новое имя, затем номер телефона через перенос строки.\nНапример:\nИван Иванов\n+79990000000',
      Markup.keyboard([[ 'Отмена' ]]).resize()
    );
    return ctx.wizard.next();
  }

  if (text === 'Редактировать реквизиты') {
    await ctx.reply(
      'Отправьте реквизиты через перенос строки в формате:\nИНН\nНаименование организации\nОГРН\nЮр.адрес',
      Markup.keyboard([[ 'Отмена' ]]).resize()
    );
    // @ts-ignore
    ctx.wizard.selectStep(6);
    return;
  }

  if (text === 'Изменить Адрес отправки Сдек') {
    await ctx.reply('Отправьте новый адрес пункта Сдек:', Markup.keyboard([[ 'Отмена' ]]).resize());
    // Переходим на шаг редактирования адреса (см. список шагов внизу)
    // @ts-ignore
    ctx.wizard.selectStep(5);
    return;
  }

  if (text === 'Назад') {
    await ctx.reply('Возвращаемся в меню.', await getMainMenuUser());
    return ctx.scene.leave();
  }
};

const profileDeleteConfirm = async (ctx: Scenes.WizardContext) => {
  if (!ctx.message || !('text' in ctx.message)) return;
  const text = ctx.message.text;
  const telegramId = ctx.from?.id ? String(ctx.from.id) : '';

  if (text === 'Удалить всё' || text === 'Удалить только профиль') {
    // Если выбрали удалить всё — чистим заказы и историю
    if (text === 'Удалить всё') {
      try {
        const { OrderRepository } = await import('../repositories/orderRepository');
        const { SearchHistoryRepository } = await import('../repositories/searchHistoryRepository');
        await OrderRepository.deleteAllByTelegramId(telegramId);
        await SearchHistoryRepository.clear(telegramId);
      } catch (e) { /* ignore */ }
    }
    const result = await ClientRepository.delete(telegramId);
    await ctx.reply(result.message, await getMainMenuGuest());
    return ctx.scene.leave();
  }

  if (text === 'Отмена' || text === 'Назад') {
    await ctx.reply('Удаление отменено.', await getMainMenuUser());
    return ctx.scene.leave();
  }
};

const profileEdit = async (ctx: Scenes.WizardContext) => {
  if (!ctx.message || !('text' in ctx.message)) return;
  const rawText = (ctx.message.text || '').trim();

  if (rawText === 'Отмена' || rawText === 'Назад') {
    await ctx.reply('Изменение отменено.', await getMainMenuUser());
    return ctx.scene.leave();
  }

  const payload = rawText.split('\n').map((s) => s.trim()).filter(Boolean);

  if (payload.length < 2) {
    await ctx.reply(
      'Некорректный формат. Отправьте имя и телефон через перенос строки.\nНапример:\nИван Иванов\n+79990000000',
      Markup.keyboard([[ 'Отмена' ]]).resize()
    );
    return; // остаёмся на текущем шаге
  }

  const [name, phone] = payload;
  // Сохраняем во временное состояние для подтверждения
  // @ts-ignore
  ctx.wizard.state.tempName = name;
  // @ts-ignore
  ctx.wizard.state.tempPhone = phone;

  await ctx.reply(
    `Вы ввели новые данные:\nИмя: ${name}\nТелефон: ${phone}\n\nСохранить изменения?`,
    Markup.keyboard([[ 'Сохранить', 'Отмена' ]]).resize()
  );
  return ctx.wizard.next();
};

const profileEditConfirm = async (ctx: Scenes.WizardContext) => {
  if (!ctx.message || !('text' in ctx.message)) return;
  const text = ctx.message.text;
  const telegramId = ctx.from?.id ? String(ctx.from.id) : '';

  if (text === 'Сохранить') {
    // @ts-ignore
    const name = ctx.wizard.state.tempName as string;
    // @ts-ignore
    const phone = ctx.wizard.state.tempPhone as string;
    const result = await ClientRepository.update(telegramId, { name, phone });
    await ctx.reply(result.message, await getMainMenuUser());
    return ctx.scene.leave();
  }

  if (text === 'Отмена' || text === 'Назад') {
    await ctx.reply('Изменения отменены.', await getMainMenuUser());
    return ctx.scene.leave();
  }
};

const profileScene = new Scenes.WizardScene<Scenes.WizardContext>(
  'profile',
  profileEnter,
  profileHandle,
  profileEdit,
  profileEditConfirm,
  profileDeleteConfirm,
  // Шаг 5: редактирование адреса Сдек
  async (ctx: Scenes.WizardContext) => {
    if (!ctx.message || !('text' in ctx.message)) return;
    const text = (ctx.message.text || '').trim();
    const telegramId = ctx.from?.id ? String(ctx.from.id) : '';

    if (text === 'Отмена' || text === 'Назад') {
      await ctx.reply('Изменение адреса отменено.', await getMainMenuUser());
      return ctx.scene.leave();
    }

    if (!telegramId) {
      await ctx.reply('Не удалось определить Telegram ID.');
      return ctx.scene.leave();
    }

    if (!text) {
      await ctx.reply('Пожалуйста, отправьте адрес текстом или нажмите Отмена.', Markup.keyboard([[ 'Отмена' ]]).resize());
      return; // остаёмся на текущем шаге
    }

    const result = await ClientRepository.update(telegramId, { address: text });
    await ctx.reply(result.message, await getMainMenuUser());
    return ctx.scene.leave();
  }
  ,
  // Шаг 6: ввод реквизитов организации
  async (ctx: Scenes.WizardContext) => {
    if (!ctx.message || !('text' in ctx.message)) return;
    const rawText = (ctx.message.text || '').trim();

    if (rawText === 'Отмена' || rawText === 'Назад') {
      await ctx.reply('Изменение отменено.', await getMainMenuUser());
      return ctx.scene.leave();
    }

    const parts = rawText.split('\n').map((s) => s.trim()).filter(Boolean);
    if (parts.length < 4) {
      await ctx.reply('Нужно передать 4 строки: ИНН, Наименование, ОГРН, Юр.адрес. Попробуйте снова.', Markup.keyboard([[ 'Отмена' ]]).resize());
      return; // остаёмся на шаге
    }

    const [org_inn, org_title, org_ogrn, org_address] = parts;
    // @ts-ignore
    ctx.wizard.state.org_inn = org_inn;
    // @ts-ignore
    ctx.wizard.state.org_title = org_title;
    // @ts-ignore
    ctx.wizard.state.org_ogrn = org_ogrn;
    // @ts-ignore
    ctx.wizard.state.org_address = org_address;

    await ctx.reply(
      `Проверьте реквизиты:\nИНН: ${org_inn}\nНаименование: ${org_title}\nОГРН: ${org_ogrn}\nЮр.адрес: ${org_address}\n\nСохранить изменения?`,
      Markup.keyboard([[ 'Сохранить', 'Отмена' ]]).resize()
    );
    // @ts-ignore
    ctx.wizard.selectStep(7);
  }
  ,
  // Шаг 7: подтверждение реквизитов
  async (ctx: Scenes.WizardContext) => {
    if (!ctx.message || !('text' in ctx.message)) return;
    const text = ctx.message.text;
    const telegramId = ctx.from?.id ? String(ctx.from.id) : '';

    if (text === 'Сохранить') {
      // @ts-ignore
      const org_inn = ctx.wizard.state.org_inn as string;
      // @ts-ignore
      const org_title = ctx.wizard.state.org_title as string;
      // @ts-ignore
      const org_ogrn = ctx.wizard.state.org_ogrn as string;
      // @ts-ignore
      const org_address = ctx.wizard.state.org_address as string;
      const result = await ClientRepository.update(telegramId, { org_inn, org_title, org_ogrn, org_address });
      await ctx.reply(result.message, await getMainMenuUser());
      return ctx.scene.leave();
    }

    if (text === 'Отмена' || text === 'Назад') {
      await ctx.reply('Изменения отменены.', await getMainMenuUser());
      return ctx.scene.leave();
    }
  }
);

export default profileScene;


