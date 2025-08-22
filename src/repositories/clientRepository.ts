import { db } from '../db';
import { client } from '../models';
import { eq } from 'drizzle-orm';
import { DatabaseError } from 'pg';

interface Client {
  id: number;
  telegram_id: string;
  phone: string;
  name: string;
  datetime: Date;
}

export const ClientRepository = {
  async insert(telegramId: string, phone: string, name: string) {
    try {
      await db.insert(client).values({ telegram_id: telegramId, phone, name });
      return { success: true, message: 'Клиент успешно добавлен.' };
    } catch (error) {
      if (error instanceof DatabaseError && (error as DatabaseError).code === '23505') {
        return { success: false, message: 'Клиент с таким telegramId уже существует.' };
      }
      console.error('Ошибка при добавлении клиента:', error);
      return { success: false, message: 'Произошла ошибка при добавлении клиента.' };
    }
  },

  async get(telegramId: string): Promise<Client[] | { success: boolean; message: string }> {
    try {
      const clients = await db.select().from(client).where(eq(client.telegram_id, telegramId));
      return clients as Client[];
    } catch (error: any) {
      console.error('Поиск клиента:', error?.message || '');
      return { success: false, message: 'Клиент не найден' };
    }
  },

  async update(telegramId: string, data: Partial<Pick<Client, 'name' | 'phone'>>) {
    try {
      const updateData: any = {};
      if (typeof data.name === 'string' && data.name.trim() !== '') updateData.name = data.name.trim();
      if (typeof data.phone === 'string' && data.phone.trim() !== '') updateData.phone = data.phone.trim();
      if (Object.keys(updateData).length === 0) {
        return { success: false, message: 'Нет данных для обновления.' };
      }
      await db.update(client).set(updateData).where(eq(client.telegram_id, telegramId));
      return { success: true, message: 'Данные клиента обновлены.' };
    } catch (error) {
      console.error('Ошибка при обновлении клиента:', error);
      return { success: false, message: 'Произошла ошибка при обновлении клиента.' };
    }
  },

  async delete(telegramId: string) {
    try {
      await db.delete(client).where(eq(client.telegram_id, telegramId));
      return { success: true, message: 'Клиент удалён.' };
    } catch (error) {
      console.error('Ошибка при удалении клиента:', error);
      return { success: false, message: 'Произошла ошибка при удалении клиента.' };
    }
  },
};



