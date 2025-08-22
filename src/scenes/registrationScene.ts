import { Scenes } from 'telegraf';
import { ClientRepository } from '../repositories/clientRepository';

// Универсальный контекст для совместимости
interface RegistrationWizardState {
  name?: string;
  phoneNumber?: string;
}

const registrationStep1 = async (ctx: Scenes.WizardContext) => {
  await ctx.reply('Пожалуйста, введите ваше имя:');
  return ctx.wizard.next();
};

const registrationStep2 = async (ctx: Scenes.WizardContext) => {
  if (ctx.message && 'text' in ctx.message) {
    const name = (ctx.message.text || '').trim();
    if (!name) {
      await ctx.reply('Имя не может быть пустым. Пожалуйста, введите ваше имя:');
      return; // остаёмся на шаге 2
    }
    (ctx.wizard.state as RegistrationWizardState).name = name;
    await ctx.reply('Пожалуйста, введите ваш номер телефона:');
    return ctx.wizard.next();
  }
  await ctx.reply('Пожалуйста, введите ваше имя текстом.');
};

const registrationStep3 = async (ctx: Scenes.WizardContext) => {
  if (ctx.message && 'text' in ctx.message) {
    const phoneNumber = (ctx.message.text || '').trim();
    if (!phoneNumber) {
      await ctx.reply('Номер телефона не может быть пустым. Пожалуйста, введите ваш номер телефона:');
      return; // остаёмся на шаге 3
    }
    (ctx.wizard.state as RegistrationWizardState).phoneNumber = phoneNumber;

    const telegramId = ctx.from?.id ? String(ctx.from.id) : '';
    const name = (ctx.wizard.state as RegistrationWizardState).name || '';

    if (!telegramId) {
      await ctx.reply('Не удалось определить ваш Telegram ID. Попробуйте позже.');
      return ctx.scene.leave();
    }

    try {
      const result = await ClientRepository.insert(telegramId, phoneNumber, name);
      if ((result as any)?.success === false) {
        await ctx.reply((result as any).message || 'Не удалось сохранить данные клиента.');
      } else {
        await ctx.reply('Регистрация завершена. Спасибо!');
      }
    } catch (e) {
      await ctx.reply('Произошла ошибка при сохранении данных. Попробуйте позже.');
    }
    return ctx.scene.leave();
  }
  await ctx.reply('Пожалуйста, введите ваш номер телефона текстом.');
};

const registrationScene = new Scenes.WizardScene<Scenes.WizardContext>(
  'registration',
  registrationStep1,
  registrationStep2,
  registrationStep3
);

export default registrationScene;
