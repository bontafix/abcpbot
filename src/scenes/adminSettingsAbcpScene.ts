import { Scenes } from 'telegraf';
import { isOneOf } from '../utils/text';
import { SettingsService } from '../services/settingsService';
import { AbcpSettings, AbcpFieldOrder, validateAbcpField } from '../utils/validation';
import { showAdminHeader, deleteUserMessage } from '../utils/adminUi';

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
  const data = await SettingsService.getCategory('abcp');
  const masked: Record<string, any> = {};
  Object.entries(data).forEach(([k, v]) => masked[k] = k.toLowerCase().includes('secret') ? '***' : v);
  await ctx.reply('Текущие значения (abcp):\n```\n' + JSON.stringify(masked, null, 2) + '\n```', { parse_mode: 'Markdown' } as any);
}

const step1 = async (ctx: AnyContext) => {
  await showAdminHeader(ctx, 'Настройки бота — Abcp');
  (ctx.wizard.state as any).idx = 0;
  await showCurrent(ctx);
  const field = AbcpFieldOrder[0];
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
    const field = AbcpFieldOrder[idx];
    const v = validateAbcpField(field, t);
    if (!v.ok) {
      await ctx.reply(`Ошибка: ${v.error}. Повторите ввод для ${field}:`);
      return;
    }
    s.values = s.values || {};
    s.values[field] = v.value;
    if (idx + 1 < AbcpFieldOrder.length) {
      s.idx = idx + 1;
      const nextField = AbcpFieldOrder[s.idx];
      await ctx.reply(`Введите значение для ${nextField}:`);
      return;
    }
    // Сохраняем
    const updatedBy = ctx.from?.id ? String(ctx.from.id) : undefined;
    const values: AbcpSettings = s.values || {};
    for (const [k, val] of Object.entries(values)) {
      await SettingsService.set('abcp', k, val, updatedBy);
    }
    await ctx.reply('✅ Сохранено.');
    try { await ctx.scene.leave(); } catch {}
    // @ts-ignore
    return ctx.scene.enter('admin_settings');
  }
};

const abcpSettingsScene = new Scenes.WizardScene<AnyContext>(
  'admin_settings_abcp',
  step1,
  stepInput
);

export default abcpSettingsScene;


