import { Scenes } from 'telegraf';

type AnyContext = Scenes.WizardContext & { scene: any; wizard: any };

const adminStep = async (ctx: AnyContext) => {
  const text = 'Админ-панель:\n\nВыберите действие:';
  await ctx.reply(text, {
    reply_markup: {
      inline_keyboard: [
        [ { text: 'Список клиентов', callback_data: 'admin:clients' } ],
      ],
    },
  } as any);
};

const adminScene = new Scenes.WizardScene<AnyContext>('admin_scene', adminStep);

adminScene.action('admin:clients', async (ctx) => {
  await ctx.answerCbQuery();
  // @ts-ignore
  return ctx.scene.enter('admin_clients');
});

export default adminScene;


