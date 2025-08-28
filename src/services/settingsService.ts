import Redis from 'ioredis';
import { db } from '../db';
import { bot_settings, settings_audit } from '../models';
import { and, eq } from 'drizzle-orm';

const redis = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379');

const CACHE_TTL_SECONDS = Number(process.env.SETTINGS_CACHE_TTL || 90);

function buildCacheKey(category: string, key?: string) {
  return key ? `settings:${category}:${key}` : `settings:${category}`;
}

function envFallback(category: string, key: string): string | undefined {
  const envName = `SETTINGS_${category}_${key}`
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .toUpperCase();
  return process.env[envName];
}

export const SettingsService = {
  async get(category: string, key: string): Promise<any | null> {
    const cacheKey = buildCacheKey(category, key);
    try {
      const cached = await redis.get(cacheKey);
      if (cached != null) {
        return JSON.parse(cached);
      }
    } catch {}

    const rows = await db
      .select()
      .from(bot_settings)
      .where(and(eq(bot_settings.category, category), eq(bot_settings.key, key)));

    if (rows.length > 0) {
      const val = rows[0].value as any;
      try { await redis.set(cacheKey, JSON.stringify(val), 'EX', CACHE_TTL_SECONDS); } catch {}
      return val;
    }

    const envVal = envFallback(category, key);
    if (envVal !== undefined) {
      try { await redis.set(cacheKey, JSON.stringify(envVal), 'EX', CACHE_TTL_SECONDS); } catch {}
      return envVal;
    }
    return null;
  },

  async getCategory(category: string): Promise<Record<string, any>> {
    const cacheKey = buildCacheKey(category);
    try {
      const cached = await redis.get(cacheKey);
      if (cached != null) {
        return JSON.parse(cached);
      }
    } catch {}

    const rows = await db
      .select()
      .from(bot_settings)
      .where(eq(bot_settings.category, category));

    const result: Record<string, any> = {};
    for (const r of rows) {
      result[r.key as string] = r.value as any;
    }

    // Добавим env fallback-ы, не перезаписывая БД значения
    Object.keys(process.env).forEach((envName) => {
      const prefix = `SETTINGS_${category}_`;
      if (envName.startsWith(prefix)) {
        const k = envName.substring(prefix.length).toLowerCase();
        if (!(k in result)) {
          result[k] = process.env[envName];
        }
      }
    });

    try { await redis.set(cacheKey, JSON.stringify(result), 'EX', CACHE_TTL_SECONDS); } catch {}
    return result;
  },

  async set(category: string, key: string, value: any, updatedBy?: string): Promise<void> {
    // Прочитаем старое значение для аудита
    const prevRows = await db
      .select()
      .from(bot_settings)
      .where(and(eq(bot_settings.category, category), eq(bot_settings.key, key)));
    const oldValue = prevRows.length > 0 ? (prevRows[0].value as any) : null;

    // upsert по (category, key)
    await db.insert(bot_settings).values({
      category,
      key,
      value,
      updated_by: updatedBy,
    } as any).onConflictDoUpdate({
      target: [bot_settings.category, bot_settings.key],
      set: {
        value,
        updated_by: updatedBy,
        updated_at: new Date(),
      } as any,
    });

    // Аудит
    await db.insert(settings_audit).values({
      category,
      key,
      old_value: oldValue,
      new_value: value,
      updated_by: updatedBy,
    } as any);

    // Инвалидация кэша
    try {
      await redis.del(buildCacheKey(category, key));
      await redis.del(buildCacheKey(category));
    } catch {}
  },
};

export type SettingsCategory = 'manager' | 'abcp' | 'bank' | (string & {});

