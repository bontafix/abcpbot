import { Scenes } from 'telegraf';
import { isOneOf } from '../utils/text';
import { showAdminHeader, deleteUserMessage } from '../utils/adminUi';
import { SettingsService } from '../services/settingsService';
import { ManagerSettings, validateManagerField } from '../utils/validation';

type AnyContext = Scenes.WizardContext & { scene: any; wizard: any };

function getKeyboard() {
  return {
    keyboard: [
      [{ text: '✖️ Отмена' }],
    ],
    resize_keyboard: true,
  } as any;
}

async function showCurrent(ctx: AnyContext) {
  // Читаем по ключам, чтобы избежать возможного устаревшего категорийного кэша
  const [phoneRaw, tgIdRaw, nameRaw] = await Promise.all([
    SettingsService.get('manager', 'phone'),
    SettingsService.get('manager', 'telegram_user_id'),
    SettingsService.get('manager', 'display_name'),
  ]);
  const phone = String(phoneRaw || '').trim();
  const tgId = String(tgIdRaw || '').trim();
  const name = String(nameRaw || '').trim();

  const text = [
    'Настройки менеджера:',
    '',
    `Телефон: ${phone || 'не указан'}`,
    `ID: ${tgId || 'не указан'}`,
    `Имя: ${name || 'не указано'}`,
  ].join('\n');

  await ctx.reply(text, {
    reply_markup: {
      inline_keyboard: [
        [ { text: '✏️ Телефон', callback_data: 'edit:phone' } ],
        [ { text: '✏️ ID', callback_data: 'edit:telegram_user_id' } ],
        [ { text: '✏️ Имя', callback_data: 'edit:display_name' } ],
        [ { text: '⬅️ Назад', callback_data: 'back' } ],
      ],
    },
  } as any);
}

const step1 = async (ctx: AnyContext) => {
  await showAdminHeader(ctx, 'Настройки бота — Менеджер');
  (ctx.wizard.state as any).editingField = undefined;
  await showCurrent(ctx);
  return ctx.wizard.next();
};

const stepInput = async (ctx: AnyContext) => {
  // Обработка нажатий на inline-кнопки
  if (ctx.callbackQuery && 'data' in ctx.callbackQuery) {
    const data = (ctx.callbackQuery as any).data as string;
    await ctx.answerCbQuery();
    if (data === 'back') {
      try { await ctx.scene.leave(); } catch {}
      // @ts-ignore
      return ctx.scene.enter('admin_settings');
    }
    if (data.startsWith('edit:')) {
      const field = data.substring('edit:'.length) as keyof ManagerSettings;
      (ctx.wizard.state as any).editingField = field;
      const label = field === 'phone' ? 'телефон' : field === 'telegram_user_id' ? 'Telegram ID' : 'имя';
      await ctx.reply(`Введите новое значение (${label}):`, { reply_markup: getKeyboard() });
      return;
    }
  }

  if (ctx.message && 'text' in ctx.message) {
    await deleteUserMessage(ctx);
    const t = (ctx.message.text || '').trim();
    if (isOneOf(t, ['Отмена'])) {
      const field = (ctx.wizard.state as any).editingField as keyof ManagerSettings | undefined;
      if (field) {
        (ctx.wizard.state as any).editingField = undefined;
        await ctx.reply('Отменено.');
        await showCurrent(ctx);
        return;
      } else {
        try { await ctx.scene.leave(); } catch {}
        // @ts-ignore
        return ctx.scene.enter('admin_settings');
      }
    }
    const field = (ctx.wizard.state as any).editingField as keyof ManagerSettings | undefined;
    if (!field) {
      await ctx.reply('Выберите, что изменить, с помощью кнопок ниже.');
      await showCurrent(ctx);
      return;
    }
    const v = validateManagerField(field, t);
    if (!v.ok) {
      await ctx.reply(`Ошибка: ${v.error}. Повторите ввод:`);
      return;
    }
    try {
      const updatedBy = ctx.from?.id ? String(ctx.from.id) : undefined;
      await SettingsService.set('manager', field, v.value, updatedBy);
      await ctx.reply('✅ Сохранено.');
    } catch (e) {
      await ctx.reply('Не удалось сохранить. Попробуйте позже.');
    }
    (ctx.wizard.state as any).editingField = undefined;
    await showCurrent(ctx);
    return;
  }
};

const managerSettingsScene = new Scenes.WizardScene<AnyContext>(
  'admin_settings_manager',
  step1,
  stepInput
);

export default managerSettingsScene;


