import { Scenes } from 'telegraf';
import { showAdminHeader } from '../utils/adminUi';

type AnyContext = Scenes.SceneContext & { scene: any };

function getSettingsKeyboard() {
  return {
    keyboard: [
      // [{ text: 'Менеджер' }, { text: 'Abcp' }, { text: 'Банк' }],
      [{ text: 'Менеджер' }, { text: 'Помощь' }],
      [{ text: 'Назад' }],
    ],
    resize_keyboard: true,
    one_time_keyboard: false,
  } as any;
}

const enterStep = async (ctx: AnyContext) => {
  await showAdminHeader(ctx, 'Настройки бота');
  await ctx.reply('Выберите раздел:', { reply_markup: getSettingsKeyboard() });
};

const settingsScene = new Scenes.BaseScene<AnyContext>('admin_settings');

settingsScene.enter(enterStep);

settingsScene.hears('Назад', async (ctx) => {
  try { await ctx.scene.leave(); } catch {}
  // @ts-ignore
  await ctx.scene.enter('admin_scene');
});

// Заглушки для разделов. Позже можно заменить на отдельные сцены/визарды
settingsScene.hears('Менеджер', async (ctx) => {
  try { await ctx.scene.leave(); } catch {}
  // @ts-ignore
  await ctx.scene.enter('admin_settings_manager');
});

settingsScene.hears('Abcp', async (ctx) => {
  try { await ctx.scene.leave(); } catch {}
  // @ts-ignore
  await ctx.scene.enter('admin_settings_abcp');
});

settingsScene.hears('Банк', async (ctx) => {
  try { await ctx.scene.leave(); } catch {}
  // @ts-ignore
  await ctx.scene.enter('admin_settings_bank');
});
settingsScene.hears('Помощь', async (ctx) => {
  try { await ctx.scene.leave(); } catch {}
  // @ts-ignore
  await ctx.scene.enter('admin_settings_help');
});


export default settingsScene;


