import { Scenes } from 'telegraf';
import { SettingsService } from '../services/settingsService';
import { BankSettings, BankFieldOrder, validateBankField } from '../utils/validation';
import { showAdminHeader, deleteUserMessage } from '../utils/adminUi';

type AnyContext = Scenes.WizardContext & { scene: any; wizard: any };

function getKeyboard() {
  return {
    keyboard: [
      [{ text: 'Отмена' }],
    ],
    resize_keyboard: true,
  } as any;
}

async function showCurrent(ctx: AnyContext) {
  const data = await SettingsService.getCategory('bank');
  await ctx.reply('Текущие значения (bank):\n```\n' + JSON.stringify(data, null, 2) + '\n```', { parse_mode: 'Markdown' } as any);
}

const step1 = async (ctx: AnyContext) => {
  await showAdminHeader(ctx, 'Настройки бота — Банк');
  (ctx.wizard.state as any).idx = 0;
  await showCurrent(ctx);
  const field = BankFieldOrder[0];
  await ctx.reply(`Введите значение для ${field}:`, { reply_markup: getKeyboard() });
  return ctx.wizard.next();
};

const stepInput = async (ctx: AnyContext) => {
  if (ctx.message && 'text' in ctx.message) {
    await deleteUserMessage(ctx);
    const t = (ctx.message.text || '').trim();
    if (t === 'Отмена') {
      try { await ctx.scene.leave(); } catch {}
      // @ts-ignore
      return ctx.scene.enter('admin_settings');
    }
    const s = ctx.wizard.state as any;
    const idx = s.idx as number;
    const field = BankFieldOrder[idx];
    const v = validateBankField(field, t);
    if (!v.ok) {
      await ctx.reply(`Ошибка: ${v.error}. Повторите ввод для ${field}:`);
      return;
    }
    s.values = s.values || {};
    s.values[field] = v.value;
    if (idx + 1 < BankFieldOrder.length) {
      s.idx = idx + 1;
      const nextField = BankFieldOrder[s.idx];
      await ctx.reply(`Введите значение для ${nextField}:`);
      return;
    }
    // Сохраняем
    const updatedBy = ctx.from?.id ? String(ctx.from.id) : undefined;
    const values: BankSettings = s.values || {};
    for (const [k, val] of Object.entries(values)) {
      await SettingsService.set('bank', k, val, updatedBy);
    }
    await ctx.reply('✅ Сохранено.');
    try { await ctx.scene.leave(); } catch {}
    // @ts-ignore
    return ctx.scene.enter('admin_settings');
  }
};

const bankSettingsScene = new Scenes.WizardScene<AnyContext>(
  'admin_settings_bank',
  step1,
  stepInput
);

export default bankSettingsScene;


