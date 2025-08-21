import { Markup } from 'telegraf';
import { UserRepository } from './repositories/userRepository';
import { Scenes } from 'telegraf';
import registrationScene from './scenes/registrationScene';


export function getProfileMenu(listProfile: any, uniqueParam?: number) {

  const buttons = listProfile.map((item: any) => {
    return Markup.button.callback(
      item.name,
      `profile_${item.id}_${uniqueParam || ''}` // Добавляем уникальный параметр
    );
  })

  return Markup.inlineKeyboard(buttons, { columns: 1 });
}
export async function getMainMenuUser() {

  return Markup.keyboard([
    [
      'Поиск',
      'Профиль',
      'Заказы',
    ]
  ]).resize();
}
export async function getMainMenuGuest() {

  return Markup.keyboard([
    ['Поиск',
      'Регистрация']
  ]).resize();
}

// // // Добавляем обработчик для кнопки 'Регистрация'
// export function handleGuestMenuSelection(ctx: Scenes.WizardContext) {
//   if (ctx.message && 'text' in ctx.message) {
//     const selection = ctx.message.text;
//     if (selection === 'Регистрация') {
//       ctx.scene.enter('registration');
//     }
//   }
// }

