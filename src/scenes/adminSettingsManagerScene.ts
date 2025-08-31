import { Scenes } from 'telegraf';
import { isOneOf } from '../utils/text';
import { showAdminHeader, deleteUserMessage } from '../utils/adminUi';
import { SettingsService } from '../services/settingsService';
import { ManagerSettings, ManagerFieldOrder, validateManagerField } from '../utils/validation';

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
  const data = await SettingsService.getCategory('manager');
  const masked: Record<string, any> = {};
  Object.entries(data).forEach(([k, v]) => masked[k] = k.toLowerCase().includes('phone') ? v : v);
  await ctx.reply('Текущие значения (manager):\n```\n' + JSON.stringify(masked, null, 2) + '\n```', { parse_mode: 'Markdown' } as any);
}

const step1 = async (ctx: AnyContext) => {
  await showAdminHeader(ctx, 'Настройки бота — Менеджер');
  (ctx.wizard.state as any).idx = 0;
  await showCurrent(ctx);
  const field = ManagerFieldOrder[0];
  await ctx.reply(`Введите значение для ${field}:`, { reply_markup: getKeyboard() });
  return ctx.wizard.next();
};

const stepInput = async (ctx: AnyContext) => {
  if (ctx.message && 'text' in ctx.message) {
    await deleteUserMessage(ctx);
    const t = (ctx.message.text || '').trim();
    if (isOneOf(t, ['Отмена'])) {
      try { await ctx.scene.leave(); } catch {}
      // @ts-ignore
      return ctx.scene.enter('admin_settings');
    }
    const s = ctx.wizard.state as any;
    const idx = s.idx as number;
    const field = ManagerFieldOrder[idx];
    const v = validateManagerField(field, t);
    if (!v.ok) {
      await ctx.reply(`Ошибка: ${v.error}. Повторите ввод для ${field}:`);
      return;
    }
    s.values = s.values || {};
    s.values[field] = v.value;
    if (idx + 1 < ManagerFieldOrder.length) {
      s.idx = idx + 1;
      const nextField = ManagerFieldOrder[s.idx];
      await ctx.reply(`Введите значение для ${nextField}:`);
      return;
    }
    // Сохраняем
    const updatedBy = ctx.from?.id ? String(ctx.from.id) : undefined;
    const values: ManagerSettings = s.values || {};
    for (const [k, val] of Object.entries(values)) {
      await SettingsService.set('manager', k, val, updatedBy);
    }
    await ctx.reply('✅ Сохранено.');
    try { await ctx.scene.leave(); } catch {}
    // @ts-ignore
    return ctx.scene.enter('admin_settings');
  }
};

const managerSettingsScene = new Scenes.WizardScene<AnyContext>(
  'admin_settings_manager',
  step1,
  stepInput
);

export default managerSettingsScene;


