import { db } from '../db';
import { order } from '../models';
import { eq } from 'drizzle-orm';
import { DatabaseError } from 'pg';

export interface OrderItem {
  number: string;
  title: string;
  count: number;
  price: number;
}

export interface OrderRow {
  id: number;
  telegram_id: string;
  name: string;
  phone: string;
  description: string | null;
  items: OrderItem[];
  status: string;
  status_datetime: Date;
  datetime: Date;
}

export const OrderRepository = {
  async create(telegramId: string, items: OrderItem[], description: string | undefined, name: string, phone: string) {
    try {
      await db.insert(order).values({ telegram_id: telegramId, items, description, name, phone });
      return { success: true, message: 'Заказ создан.' };
    } catch (error) {
      if (error instanceof DatabaseError) {
        console.error('PG error при создании заказа:', error.code, error.detail || '');
      } else {
        console.error('Ошибка при создании заказа:', error);
      }
      return { success: false, message: 'Не удалось создать заказ.' };
    }
  },

  async getByTelegramId(telegramId: string): Promise<OrderRow[] | { success: boolean; message: string }> {
    try {
      const rows = await db.select().from(order).where(eq(order.telegram_id, telegramId));
      return rows as unknown as OrderRow[];
    } catch (error: any) {
      console.error('Ошибка при получении заказов:', error?.message || '');
      return { success: false, message: 'Не удалось получить заказы.' };
    }
  },

  async updateStatus(orderId: number, status: string) {
    try {
      await db
        .update(order)
        .set({ status, status_datetime: new Date() })
        .where(eq(order.id, orderId));
      return { success: true, message: 'Статус заказа обновлён.' };
    } catch (error) {
      console.error('Ошибка при обновлении статуса заказа:', error);
      return { success: false, message: 'Не удалось обновить статус заказа.' };
    }
  },

  async deleteById(orderId: number, telegramId: string) {
    try {
      // Удаляем только заказ текущего пользователя
      const { and } = await import('drizzle-orm');
      // @ts-ignore drizzle and() typing workaround for dynamic import
      await db.delete(order).where(and(eq(order.id, orderId), eq(order.telegram_id, telegramId)));
      return { success: true, message: `Заказ #${orderId} удалён.` };
    } catch (error) {
      console.error('Ошибка при удалении заказа:', error);
      return { success: false, message: 'Не удалось удалить заказ.' };
    }
  },

  async deleteAllByTelegramId(telegramId: string) {
    try {
      await db.delete(order).where(eq(order.telegram_id, telegramId));
      return { success: true, message: 'Все заказы удалены.' };
    } catch (error) {
      console.error('Ошибка при удалении заказов пользователя:', error);
      return { success: false, message: 'Не удалось удалить заказы.' };
    }
  },
};


