import { db } from '../db';
import { search_history } from '../models';
import { desc, eq } from 'drizzle-orm';

export const SearchHistoryRepository = {
  async add(telegramId: string, query: string, resultsCount = 0) {
    if (!query || !query.trim()) return { success: false };
    await db.insert(search_history).values({ telegram_id: telegramId, query: query.trim(), results_count: Number(resultsCount) || 0 });
    return { success: true };
  },

  async last(telegramId: string, limit = 10) {
    const rows = await db
      .select()
      .from(search_history)
      .where(eq(search_history.telegram_id, telegramId))
      .orderBy(desc(search_history.datetime))
      .limit(limit);
    return rows;
  },

  async clear(telegramId: string) {
    await db.delete(search_history).where(eq(search_history.telegram_id, telegramId));
    return { success: true };
  },
};


