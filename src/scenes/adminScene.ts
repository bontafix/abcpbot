import { Scenes } from 'telegraf';

type AnyContext = Scenes.SceneContext & { scene: any };

const adminStep = async (ctx: AnyContext) => {
  // console.log('Вход в админ сцену');
  const text = 'Админ-панель:\n\nВыберите действие:';
  await ctx.reply(text, {
    reply_markup: {
      inline_keyboard: [
        [ { text: 'Список клиентов', callback_data: 'admin:clients' } ],
        [ { text: 'Список поставщиков', callback_data: 'admin:distributors' } ],
        [ { text: '⏹ Закрыть', callback_data: 'admin:close' } ],
      ],
    },
  } as any);
  return;
};

const adminActionStep = async (ctx: AnyContext) => {
  if (ctx.callbackQuery && 'data' in ctx.callbackQuery) {
    const data = (ctx.callbackQuery as any).data as string;
    // console.log('Получено действие в админ сцене:', data);
    await ctx.answerCbQuery();
    
    if (data === 'admin:clients') {
      // console.log('Переход в сцену клиентов');
      try {
        await ctx.scene.leave();
        // @ts-ignore
        return ctx.scene.enter('admin_clients');
      } catch (error) {
        console.error('Ошибка при переходе в сцену клиентов:', error);
        await ctx.reply('Ошибка при переходе. Попробуйте команду /admin');
      }
    }
    
    if (data === 'admin:distributors') {
      console.log('Переход в сцену поставщиков');
      try {
        await ctx.scene.leave();
        // @ts-ignore
        return ctx.scene.enter('admin_distributors');
      } catch (error) {
        console.error('Ошибка при переходе в сцену поставщиков:', error);
        await ctx.reply('Ошибка при переходе. Попробуйте команду /admin');
      }
    }

    if (data === 'admin:close') {
      console.log('Выход из админ-панели');
      try {
        await ctx.scene.leave();
        await ctx.reply('Вы вышли из админ-панели.');
      } catch (error) {
        console.error('Ошибка при выходе из админ сцены:', error);
        await ctx.reply('Ошибка при выходе. Попробуйте команду /admin');
      }
      return;
    }
  }
  return;
};

const adminScene = new Scenes.BaseScene<AnyContext>('admin_scene');

adminScene.enter(adminStep);
adminScene.on('callback_query', adminActionStep);

export default adminScene;


