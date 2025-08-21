import { Markup } from 'telegraf';
import { UserRepository } from './repositories/userRepository';


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

