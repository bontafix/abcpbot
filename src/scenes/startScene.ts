import { Telegraf, session, Scenes } from 'telegraf';
import * as dotenv from 'dotenv';
import { UserRepository } from '../repositories/userRepository';
import { getProfileMenu, getMainMenuUser } from '../menu';


interface User {
  id: number;
  inn: string;
  name: string;
  telegram_id: string; // Учитывая, что telegramId передается как string
  title?: string | null | undefined; 
  datetime: Date; // или Date, в зависимости от того, как обрабатывается дата
}

// Интерфейс состояния мастера
interface RegistrationWizardState {
  inn?: string;
  name?: string;
  title?: string;
  selectedMonth?: string;
  selectedProfile?: string;

}
// Интерфейс WizardSession
interface MyWizardSession extends Scenes.WizardSessionData {
  state: RegistrationWizardState; // Указываем структуру состояния
}

// Расширяем контекст
interface MyContext extends Scenes.WizardContext<MyWizardSession> { }


// Создаём шаги мастера
const step1 = async (ctx: MyContext) => {
  if (ctx.message && 'from' in ctx.message) {
    const telegramId = String(ctx.message.from.id)
    const profileUser = await UserRepository.findUserByTelegramId(telegramId)
    await ctx.reply('Добро пожаловать! Вы зарегистрированы.\nВыберите профиль:', {
      reply_markup: {
        inline_keyboard: [
          ...getProfileMenu(profileUser, Date.now()).reply_markup.inline_keyboard, // Ваше меню с месяцами
          // [{ text: 'Отмена', callback_data: 'cancel' }], // Кнопка "Отмена"
        ],
      },
    });
    return ctx.wizard.next(); // Переход к следующему шагу
  } else {
    await ctx.reply('Непонятно');
  }
};

const step2 = async (ctx: MyContext) => {
  if (!ctx.callbackQuery || !('data' in ctx.callbackQuery)) {
    await ctx.reply('Произошла ошибка. Попробуйте снова.');
    // return;
    return ctx.scene.leave();
  }

  const state = ctx.wizard.state as RegistrationWizardState;
  console.log(ctx.callbackQuery.data)
  const selectedProfileId = ctx.callbackQuery.data.split('_')[1]; 
  // const selectedMonthId = ctx.callbackQuery.data.split('_')[1]; // Получаем ID месяца из `callback_data`
  state.selectedProfile = selectedProfileId;
  
  const profileUser = await  UserRepository.findUserById(Number(selectedProfileId));
  console.log(profileUser)
  const message = 
  `Выбран профиль:\n` +
  `ИНН: ${profileUser.inn}\n` +
  `Организация: ${profileUser.title}\n` +
  `Руководитель: ${profileUser.name}\n`

  await ctx.reply(message);
  await ctx.answerCbQuery();
  await ctx.reply('Добро пожаловать!', await getMainMenuUser());

};




// Создаём мастер
const profileWizard = new Scenes.WizardScene<MyContext>(
  'profile',
  step1,
  step2
);

export default profileWizard;  