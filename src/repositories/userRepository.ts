import { linkOrMention } from 'telegraf/typings/core/helpers/formatting';
import { db } from '../db';
// import { user } from './models';
import { user, service } from '../models';
import { eq, lt, gte, ne } from 'drizzle-orm';
import { DatabaseError } from 'pg';


interface User {
  id: number;
  inn: string;
  name: string;
  telegram_id: string; // Учитывая, что telegramId передается как string
  title?: string | null | undefined; 
  datetime: Date; // или Date, в зависимости от того, как обрабатывается дата
}

export const UserRepository = {
  async createUser(inn: string, name: string, telegramId: string, title?: string) {
    try {
      await db.insert(user).values({ inn, name, telegram_id: telegramId, title });
      return { success: true, message: 'Пользователь успешно создан.' };
    } catch (error) {
      if (error instanceof DatabaseError && error.code === '23505') {
        // Код ошибки 23505 означает нарушение уникального ограничения
        return { success: false, message: 'Пользователь с таким ИНН уже существует.' };
      }
      // Обработка других ошибок
      console.error('Ошибка при создании пользователя:', error);
      // return { success: false, message: 'Произошла ошибка при создании пользователя.' };
    }
  },

  async findUserByTelegramId(telegramId: string): Promise<User[] | { success: boolean, message: string }> {
    try {
      // Выполнение запроса и получение результата
      const users = await db.select().from(user).where(eq(user.telegram_id, telegramId));
      return users;
    } catch (error: any) {
      console.error('Поиск пользователя:', error?.message || '');
      return { success: false, message: 'Пользователь не зарегистирован' };
    }
  },
  async findUserById(id: number): Promise<User> {
    try {
      // Выполнение запроса и получение результата
      const users = await db.select().from(user).where(eq(user.id, id)).limit(1); 
      return users[0];
    } catch (error: any) {
      console.error('Поиск пользователя:', error?.message || '');
      throw(`Пользователь не найден!`)
    }
  },

  //   async updateUserTelegramId(inn: string, telegramId: string) {
  //     await db.update(user)
  //       .set({ telegram_id: telegramId })
  //       .where(user.inn.eq(inn));
  //   },

  async deleteUserByTelegramId(telegramId: string) {
    await db.delete(user).where(eq(user.telegram_id, telegramId));
  },
};
