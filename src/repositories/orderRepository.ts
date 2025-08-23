import { db } from '../db';
import { order } from '../models';
import { and, eq, gte } from 'drizzle-orm';
import { canTransitionStatus, canDeleteByStatus, isKnownStatus, canTransitionStatusAdmin } from '../utils/orderStatusRules';
import { DatabaseError } from 'pg';

export interface OrderItem {
  number: string;
  title: string;
  count: number;
  price: number;
  brand?: string;
  distributorId?: string;
  supplierCode?: string;
  lastUpdateTime?: string;
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

  async updateStatusByTelegram(orderId: number, telegramId: string, status: string) {
    try {
      // Сначала получим текущий статус заказа для проверки правил
      const rows = await db.select().from(order).where(and(eq(order.id, orderId), eq(order.telegram_id, telegramId)));
      if (!rows || rows.length === 0) {
        return { success: false, message: 'Заказ не найден или нет доступа.' };
      }
      const current = String((rows[0] as any).status || '');
      const target = String(status || '');
      if (!isKnownStatus(target)) {
        return { success: false, message: 'Недопустимый статус.' };
      }
      if (!canTransitionStatus(current, target)) {
        return { success: false, message: 'Запрещено изменять статус на выбранный.' };
      }

      const updated = await db
        .update(order)
        .set({ status: target, status_datetime: new Date() })
        .where(and(eq(order.id, orderId), eq(order.telegram_id, telegramId)))
        .returning({ id: order.id });

      if (!updated || updated.length === 0) {
        return { success: false, message: 'Заказ не найден или нет доступа.' };
      }

      return { success: true, message: 'Статус заказа обновлён.' };
    } catch (error) {
      console.error('Ошибка при обновлении статуса заказа (с проверкой telegramId):', error);
      return { success: false, message: 'Не удалось обновить статус заказа.' };
    }
  },

  async list(params: { telegramId?: string; since?: Date; page?: number; pageSize?: number }): Promise<OrderRow[]> {
    const page = Math.max(1, Number(params.page || 1));
    const pageSize = Math.min(1000, Math.max(1, Number(params.pageSize || 100)));
    const offset = (page - 1) * pageSize;

    const filterConditions: any[] = [];
    if (params.telegramId) filterConditions.push(eq(order.telegram_id, params.telegramId));
    if (params.since) filterConditions.push(gte(order.datetime, params.since));

    const whereClause = filterConditions.length ? and(...filterConditions) : undefined;

    const rows = await db
      .select()
      .from(order)
      .where(whereClause as any)
      .limit(pageSize)
      .offset(offset);

    return rows as unknown as OrderRow[];
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
      // Админский апдейт без проверки telegramId, но с админ-правилами переходов
      const rows = await db.select().from(order).where(eq(order.id, orderId));
      if (!rows || rows.length === 0) {
        return { success: false, message: 'Заказ не найден.' };
      }
      const current = String((rows[0] as any).status || '');
      const target = String(status || '');
      if (!isKnownStatus(target)) {
        return { success: false, message: 'Недопустимый статус.' };
      }
      if (!canTransitionStatusAdmin(current, target)) {
        return { success: false, message: 'Запрещён переход статуса для администратора.' };
      }
      await db
        .update(order)
        .set({ status: target, status_datetime: new Date() })
        .where(eq(order.id, orderId));
      return { success: true, message: 'Статус заказа обновлён.' };
    } catch (error) {
      console.error('Ошибка при обновлении статуса заказа:', error);
      return { success: false, message: 'Не удалось обновить статус заказа.' };
    }
  },

  async deleteById(orderId: number, telegramId: string) {
    try {
      // Проверим статус: удалять можно только заказы в статусе 'rejected'
      const rows = await db.select().from(order).where(and(eq(order.id, orderId), eq(order.telegram_id, telegramId)));
      if (!rows || rows.length === 0) {
        return { success: false, message: 'Заказ не найден или нет доступа.' };
      }
      const current = String((rows[0] as any).status || '');
      if (!canDeleteByStatus(current)) {
        return { success: false, message: 'Удаление доступно только для отклонённых заказов.' };
      }
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


