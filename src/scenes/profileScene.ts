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
    `Ваш профиль:\nИмя: ${info.name}\nТелефон: ${info.phone}`,
    Markup.keyboard([[ 'Редактировать', 'Удалить' ], [ 'Назад' ]]).resize()
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
    ctx.wizard.selectStep(3);
    return;
  }

  if (text === 'Редактировать') {
    await ctx.reply('Отправьте новое имя, затем номер телефона через перенос строки.\nНапример:\nИван Иванов\n+79990000000');
    return ctx.wizard.next();
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
  const telegramId = ctx.from?.id ? String(ctx.from.id) : '';
  const payload = (ctx.message.text || '').split('\n').map((s) => s.trim()).filter(Boolean);
  const [name, phone] = payload;
  const result = await ClientRepository.update(telegramId, { name, phone });
  await ctx.reply(result.message);
  return ctx.scene.leave();
};

const profileScene = new Scenes.WizardScene<Scenes.WizardContext>(
  'profile',
  profileEnter,
  profileHandle,
  profileEdit,
  profileDeleteConfirm
);

export default profileScene;


