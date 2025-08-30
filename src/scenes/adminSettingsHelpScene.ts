import { Scenes } from 'telegraf';
import { SettingsService } from '../services/settingsService';
import { showAdminHeader, deleteUserMessage } from '../utils/adminUi';

type AnyContext = Scenes.WizardContext & { scene: any; wizard: any };

const HELP_SECTIONS = [
  { key: 'instruction', title: 'Инструкция' },
  { key: 'search', title: 'Поиск' },
  { key: 'orders', title: 'Заказы' },
] as const;

function getDisplayKeyboard() {
  return {
    keyboard: [
      [{ text: 'Назад' }],
    ],
    resize_keyboard: true,
    one_time_keyboard: false,
  } as any;
}

function getEditKeyboard() {
  return {
    keyboard: [
      [{ text: 'Отмена' }],
    ],
    resize_keyboard: true,
  } as any;
}

async function renderSection(ctx: AnyContext, key: string, title: string) {
  const val = await SettingsService.get('help', key);
  const textValue = typeof val === 'string' ? val : (val == null ? '—' : JSON.stringify(val));
  const text = `${title}:\n\n${textValue}`;
  await ctx.reply(text, {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Изменить', callback_data: `admin_help_edit:${key}` }],
      ],
    },
  } as any);
}

async function renderAll(ctx: AnyContext) {
  for (const s of HELP_SECTIONS) {
    await renderSection(ctx, s.key, s.title);
  }
  await ctx.reply('Выберите раздел для изменения.', { reply_markup: getDisplayKeyboard() } as any);
}

const stepEnter = async (ctx: AnyContext) => {
  await showAdminHeader(ctx, 'Настройки бота — Помощь');
  (ctx.wizard.state as any).editKey = undefined;
  (ctx.wizard.state as any).editTitle = undefined;
  await renderAll(ctx);
};

const stepEdit = async (ctx: AnyContext) => {
  if (ctx.message && 'text' in ctx.message) {
    await deleteUserMessage(ctx);
    const t = (ctx.message.text || '').trim();
    if (t === 'Отмена') {
      // @ts-ignore
      ctx.wizard.selectStep(0);
      await ctx.reply('Изменение отменено. Возвращаюсь к списку.', { reply_markup: getDisplayKeyboard() } as any);
      await renderAll(ctx);
      return;
    }

    const s = ctx.wizard.state as any;
    const key = s.editKey as string | undefined;
    if (!key) {
      // @ts-ignore
      ctx.wizard.selectStep(0);
      await renderAll(ctx);
      return;
    }

    const updatedBy = ctx.from?.id ? String(ctx.from.id) : undefined;
    await SettingsService.set('help', key, t, updatedBy);
    await ctx.reply('✅ Сохранено.');
    // @ts-ignore
    ctx.wizard.selectStep(0);
    await renderAll(ctx);
    return;
  }
};

const helpSettingsScene = new Scenes.WizardScene<AnyContext>(
  'admin_settings_help',
  stepEnter,
  stepEdit
);

helpSettingsScene.hears('Назад', async (ctx) => {
  try { await ctx.scene.leave(); } catch {}
  // @ts-ignore
  await ctx.scene.enter('admin_settings');
});

helpSettingsScene.action(/^admin_help_edit:(instruction|search|orders)$/i, async (ctx: any) => {
  try { await ctx.answerCbQuery(); } catch {}
  const data = (ctx.callbackQuery?.data || '') as string;
  const key = data.split(':')[1];
  const section = HELP_SECTIONS.find((s) => s.key === key);
  (ctx.wizard.state as any).editKey = key;
  (ctx.wizard.state as any).editTitle = section?.title || key;
  await ctx.reply(`Отправьте новый текст для «${section?.title || key}».`, { reply_markup: getEditKeyboard() } as any);
  // @ts-ignore
  ctx.wizard.selectStep(1);
});

export default helpSettingsScene;


