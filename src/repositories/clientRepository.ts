import { db } from '../db';
import { client } from '../models';
import { eq, desc, count } from 'drizzle-orm';
import { DatabaseError } from 'pg';

interface Client {
  id: number;
  telegram_id: string;
  phone: string;
  name: string;
  address?: string | null;
  org_inn?: string | null;
  org_title?: string | null;
  org_ogrn?: string | null;
  org_address?: string | null;
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

  async update(telegramId: string, data: Partial<Pick<Client, 'name' | 'phone' | 'address' | 'org_inn' | 'org_title' | 'org_ogrn' | 'org_address'>>) {
    try {
      const updateData: any = {};
      if (typeof data.name === 'string' && data.name.trim() !== '') updateData.name = data.name.trim();
      if (typeof data.phone === 'string' && data.phone.trim() !== '') updateData.phone = data.phone.trim();
      if (typeof data.address === 'string' && data.address.trim() !== '') updateData.address = data.address.trim();
      if (typeof data.org_inn === 'string' && data.org_inn.trim() !== '') updateData.org_inn = data.org_inn.trim();
      if (typeof data.org_title === 'string' && data.org_title.trim() !== '') updateData.org_title = data.org_title.trim();
      if (typeof data.org_ogrn === 'string' && data.org_ogrn.trim() !== '') updateData.org_ogrn = data.org_ogrn.trim();
      if (typeof data.org_address === 'string' && data.org_address.trim() !== '') updateData.org_address = data.org_address.trim();
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

  async list(limit: number, offset: number): Promise<Client[]> {
    const safeLimit = Math.max(1, Math.min(50, Math.floor(limit)));
    const safeOffset = Math.max(0, Math.floor(offset));
    const rows = await db.select().from(client).orderBy(desc(client.id)).limit(safeLimit).offset(safeOffset);
    return rows as Client[];
  },

  async count(): Promise<number> {
    const rows = await db.select({ value: count() }).from(client);
    const total = (rows && rows[0] && typeof rows[0].value === 'number') ? rows[0].value : 0;
    return total;
  },
};



