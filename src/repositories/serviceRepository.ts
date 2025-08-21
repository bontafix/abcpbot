import { db } from '../db';
// import { service } from './models';
import { service } from '../models';
import { eq, lt, gte, ne } from 'drizzle-orm';
import { DatabaseError } from 'pg';

export const ServiceRepository = {
  // async createService(name: string, price: number) {
  //   try {
  //     await db.insert(service).values({ name: name, price: price });
  //     return { success: true, message: 'Пользователь успешно создан.' };
  //   } catch (error) {
  //     if (error instanceof DatabaseError && error.code === '23505') {
  //       // Код ошибки 23505 означает нарушение уникального ограничения
  //       return { success: false, message: 'Пользователь с таким ИНН уже существует.' };
  //     }
  //     // Обработка других ошибок
  //     console.error('Ошибка при создании пользователя:', error);
  //     return { success: false, message: 'Произошла ошибка при создании пользователя.' };
  //   }
  // },

  async getAllService() {
    return db.select().from(service);
  },

//   async updateServiceTelegramId(inn: string, telegramId: string) {
//     await db.update(service)
//       .set({ telegram_id: telegramId })
//       .where(service.inn.eq(inn));
//   },

  // async deleteServiceByTelegramId(telegramId: string) {
  //   await db.delete(service).where(eq(service.telegram_id, telegramId));
  // },
};
