import { Scenes, Markup } from 'telegraf';
import { ClientRepository } from '../repositories/clientRepository';

// Универсальный контекст для совместимости
interface RegistrationWizardState {
  name?: string;
  phoneNumber?: string;
}

// Тексты меню, которые нельзя принимать как ввод пользователя
const MENU_LABELS = new Set<string>(['Поиск', 'Регистрация', 'Профиль', 'Мои заказы']);

function isMenuOrCommand(text: string): boolean {
  const value = (text || '').trim();
  if (!value) return true;
  if (value.startsWith('/')) return true;
  if (MENU_LABELS.has(value)) return true;
  return false;
}

function isValidName(name: string): boolean {
  const value = (name || '').trim();
  if (isMenuOrCommand(value)) return false;
  // Имя: минимум 2 символа, буквы/пробелы/дефисы
  if (value.length < 2) return false;
  return /^[A-Za-zА-Яа-яЁё\-\s]{2,}$/.test(value);
}

function extractPhoneFromMessage(ctx: Scenes.WizardContext): string | null {
  const msg: any = (ctx as any).message;
  if (!msg) return null;
  if (msg.contact && msg.contact.phone_number) {
    return String(msg.contact.phone_number);
  }
  if ('text' in msg && typeof msg.text === 'string') {
    return msg.text;
  }
  return null;
}

function normalizePhone(raw: string): string {
  const trimmed = (raw || '').trim();
  const digits = trimmed.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) {
    const onlyDigits = digits.replace(/\D/g, '');
    return '+' + onlyDigits;
  }
  return digits.replace(/\D/g, '');
}

function isValidPhone(raw: string): boolean {
  const value = (raw || '').trim();
  if (isMenuOrCommand(value)) return false;
  const normalized = normalizePhone(value);
  // Требуем хотя бы 10 цифр
  const digits = normalized.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15;
}

const registrationStep1 = async (ctx: Scenes.WizardContext) => {
  await ctx.reply('Пожалуйста, введите ваше имя:', Markup.removeKeyboard());
  return ctx.wizard.next();
};

const registrationStep2 = async (ctx: Scenes.WizardContext) => {
  if (ctx.message && 'text' in ctx.message) {
    const name = (ctx.message.text || '').trim();
    if (!isValidName(name)) {
      await ctx.reply('Имя некорректно. Введите имя (только буквы, минимум 2 символа):');
      return; // остаёмся на шаге 2
    }
    (ctx.wizard.state as RegistrationWizardState).name = name;
    await ctx.reply('Пожалуйста, введите ваш номер телефона или поделитесь контактом:',
      Markup.keyboard([
        [Markup.button.contactRequest('Поделиться контактом')]
      ]).resize()
    );
    return ctx.wizard.next();
  }
  await ctx.reply('Пожалуйста, введите ваше имя текстом.');
};

const registrationStep3 = async (ctx: Scenes.WizardContext) => {
  const rawPhone = extractPhoneFromMessage(ctx);
  if (rawPhone !== null) {
    if (!isValidPhone(rawPhone)) {
      await ctx.reply('Номер телефона некорректен. Введите корректный номер или поделитесь контактом:',
        Markup.keyboard([
          [Markup.button.contactRequest('Поделиться контактом')]
        ]).resize()
      );
      return; // остаёмся на шаге 3
    }
    const phoneNumber = normalizePhone(rawPhone);
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
        return ctx.scene.leave();
      }
    } catch (e) {
      await ctx.reply('Произошла ошибка при сохранении данных. Попробуйте позже.');
      return ctx.scene.leave();
    }

    // Уведомление в служебный чат о новой регистрации
    try {
      const notifyChatId = process.env.REGISTRATION_NOTIFY_CHAT_ID || process.env.TEST_CHAT_ID;
      if (notifyChatId) {
        const username = ctx.from?.username ? `@${ctx.from.username}` : '';
        const userRef = username || `tg://user?id=${telegramId}`;
        const message = `Новая регистрация\nИмя: ${name}\nТелефон: ${phoneNumber}\nTelegram: ${userRef}\nID: ${telegramId}`;
        await ctx.telegram.sendMessage(notifyChatId, message);
      }
    } catch (err) { /* noop */ }

    // После успешной регистрации: если есть целевая сцена, переходим в неё
    const forward = (ctx.scene.state || {}) as { afterScene?: string; afterState?: any };
    if (forward.afterScene) {
      await ctx.reply('Регистрация завершена. Продолжаем.', Markup.removeKeyboard());
      // @ts-ignore
      return ctx.scene.enter(forward.afterScene, forward.afterState || {});
    }

    await ctx.reply('Регистрация завершена. Спасибо!', Markup.keyboard([
      ['Поиск', 'Профиль', 'Мои заказы']
    ]).resize());
    return ctx.scene.leave();
  }
  await ctx.reply('Пожалуйста, введите ваш номер телефона текстом или поделитесь контактом:',
    Markup.keyboard([
      [Markup.button.contactRequest('Поделиться контактом')]
    ]).resize()
  );
};

const registrationScene = new Scenes.WizardScene<Scenes.WizardContext>(
  'registration',
  registrationStep1,
  registrationStep2,
  registrationStep3
);

export default registrationScene;
