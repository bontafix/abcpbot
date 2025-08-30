import { db } from '../db';
import { order } from '../models';
import { and, eq, gte, desc } from 'drizzle-orm';
import { canTransitionStatus, canDeleteByStatus, isKnownStatus, canTransitionStatusAdmin } from '../utils/orderStatusRules';
import { DatabaseError } from 'pg';
import { bot } from '../bot';

export interface OrderItem {
  number: string;
  title: string;
  count: number;
  price: number;
  brand?: string;
  distributorId?: string;
  supplierCode?: string;
  lastUpdateTime?: string;
  comment?: string;
}

export interface OrderRow {
  id: number;
  telegram_id: string;
  name: string;
  phone: string;
  description: string | null;
  delivery?: string | null;
  items: OrderItem[];
  status: string;
  status_datetime: Date;
  datetime: Date;
}

export const OrderRepository = {
  async create(telegramId: string, items: OrderItem[], delivery: string | undefined, name: string, phone: string, description?: string): Promise<{ success: boolean; message: string; id?: number; code?: string; detail?: string; }> {
    try {
      const result = await db.insert(order).values({ telegram_id: telegramId, items, description: description ?? null, delivery, name, phone }).returning({ id: order.id });
      const orderId = result[0]?.id;

      if (orderId) {
        // Отправляем уведомление о новом заказе
        await this.sendOrderNotification({
          id: orderId,
          telegramId,
          name,
          phone,
          items,
          description: description ?? null,
          deliveryMethod: delivery
        });
        return { success: true, message: 'Заказ создан.', id: orderId };
      } else {
        console.warn('Insert returned no id for order. Payload snapshot:', {
          telegramId,
          name,
          phone,
          delivery,
          itemsCount: items?.length ?? 0,
        });
        return { success: false, message: 'Не удалось получить id заказа после вставки.' };
      }
    } catch (error) {
      if (error instanceof DatabaseError) {
        const e: any = error as any;
        const payload = {
          telegramId,
          name,
          phone,
          delivery,
          itemsCount: items?.length ?? 0,
          itemsPreview: (items || []).map(it => ({ number: it.number, count: it.count, price: it.price })),
        };
        console.error('PG error при создании заказа', {
          code: e?.code,
          message: e?.message,
          detail: e?.detail,
          schema: e?.schema,
          table: e?.table,
          column: e?.column,
          constraint: e?.constraint,
          severity: e?.severity,
          where: e?.where,
          routine: e?.routine,
          payload,
          stack: e?.stack,
        });
        return { success: false, message: 'DB error', code: String(e?.code || ''), detail: String(e?.detail || '') };
      }
      console.error('Ошибка при создании заказа (не БД):', { message: (error as any)?.message, stack: (error as any)?.stack });
      return { success: false, message: 'Unknown error' };
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
      .orderBy(desc(order.id))
      .limit(pageSize)
      .offset(offset);

    return rows as unknown as OrderRow[];
  },

  async getByTelegramId(telegramId: string): Promise<OrderRow[] | { success: boolean; message: string }> {
    try {
      const rows = await db
        .select()
        .from(order)
        .where(eq(order.telegram_id, telegramId))
        .orderBy(desc(order.id));
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

  // Функция для отправки уведомления о новом заказе в группу
  async sendOrderNotification(orderData: {
    id: number;
    telegramId: string;
    name: string;
    phone: string;
    items: OrderItem[];
    description: string | null;
    deliveryMethod?: string;
  }) {
    try {
      const notifyChatId = process.env.REGISTRATION_NOTIFY_CHAT_ID || process.env.TEST_CHAT_ID;
      console.log('🔍 Проверка переменных окружения:');
      console.log('REGISTRATION_NOTIFY_CHAT_ID:', process.env.REGISTRATION_NOTIFY_CHAT_ID);
      console.log('TEST_CHAT_ID:', process.env.TEST_CHAT_ID);
      console.log('notifyChatId:', notifyChatId);

      if (!notifyChatId) {
        console.log('❌ REGISTRATION_NOTIFY_CHAT_ID не настроен, уведомление не отправлено');
        console.log('📝 Доступные переменные окружения:', Object.keys(process.env).filter(key =>
          key.includes('CHAT') || key.includes('TELEGRAM') || key.includes('BOT')
        ));
        return;
      }

      // Проверяем формат Chat ID
      const chatIdNum = parseInt(notifyChatId);
      if (isNaN(chatIdNum)) {
        console.error('❌ Неверный формат Chat ID:', notifyChatId);
        return;
      }

      console.log('📤 Отправка сообщения в чат:', notifyChatId);

      const userRef = `tg://user?id=${orderData.telegramId}`;
      const itemsText = orderData.items.map(item =>
        `• ${item.brand || ''} ${item.number} - ${item.title} (${item.count} шт.)${item.comment ? `\n   💬 ${item.comment}` : ''}`
      ).join('\n');

      const totalPrice = orderData.items.reduce((sum, item) => sum + (item.price * item.count), 0);

      const message = `🆕 Новый заказ #${orderData.id}

👤 Клиент: ${orderData.name}
📞 Телефон: ${orderData.phone}
🔗 Telegram: ${userRef}
📦 ID: ${orderData.telegramId}

📋 Товары:
${itemsText}

💰 Сумма: ${totalPrice.toLocaleString('ru-RU')} ₽
🚚 Доставка: ${orderData.deliveryMethod || 'Не указана'}`;

      console.log('📨 Отправка сообщения:', message.substring(0, 100) + '...');

      await bot.telegram.sendMessage(notifyChatId, message);
      console.log(`✅ Уведомление о заказе #${orderData.id} отправлено в группу ${notifyChatId}`);
    } catch (error) {
      console.error('❌ Ошибка при отправке уведомления о заказе:', error);
      console.error('Детали ошибки:', {
        message: error instanceof Error ? error.message : String(error),
        code: error instanceof Error ? (error as any).code : 'unknown',
        response: error instanceof Error ? (error as any).response?.body : undefined
      });
    }
  },

  // Диагностическая функция для проверки отправки сообщений
  async testNotification(chatId?: string) {
    try {
      const testChatId = chatId || process.env.REGISTRATION_NOTIFY_CHAT_ID || process.env.TEST_CHAT_ID;
      if (!testChatId) {
        console.error('❌ Нет Chat ID для тестирования');
        return { success: false, message: 'Chat ID не настроен' };
      }

      console.log('🧪 Тестирование отправки в чат:', testChatId);

      const testMessage = `🧪 Тестовое сообщение
Время: ${new Date().toLocaleString('ru-RU')}
Chat ID: ${testChatId}`;

      await bot.telegram.sendMessage(testChatId, testMessage);
      console.log('✅ Тестовое сообщение отправлено успешно');
      return { success: true, message: 'Тестовое сообщение отправлено' };
    } catch (error) {
      console.error('❌ Ошибка при отправке тестового сообщения:', error);
      return { success: false, message: error instanceof Error ? error.message : String(error) };
    }
  },
};


