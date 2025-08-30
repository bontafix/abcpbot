import { pgTable, serial, text, bigint, varchar, numeric, timestamp, jsonb, integer } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';


export const user = pgTable('user', {
  id: serial('id').primaryKey(),
  inn: varchar('inn', { length: 12 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  telegram_id: varchar('telegram_id', { length: 50 }).notNull(),
  title: varchar('title', { length: 255 }),
  datetime: timestamp('created_at')
    .notNull()
    .default(sql`now()`), // Устанавливает текущее время при создании записи

});

export const service = pgTable('service', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  unit: varchar('unit', { length: 255 }).default('услуга').notNull(),
  tax: varchar('tax', { length: 20 }).default('без НДС').notNull(),
  price: numeric('price').notNull(),
  datetime: timestamp('created_at')
    .notNull()
    .default(sql`now()`), // Устанавливает текущее время при создании записи
});

export const client = pgTable('client', {
  id: serial('id').primaryKey(),
  telegram_id: varchar('telegram_id', { length: 50 }).notNull(),
  phone: varchar('phone', { length: 20 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  address: text('address'),
  org_inn: varchar('org_inn', { length: 12 }),
  org_title: varchar('org_title', { length: 255 }),
  org_ogrn: varchar('org_ogrn', { length: 15 }),
  org_address: text('org_address'),
  datetime: timestamp('created_at')
    .notNull()
    .default(sql`now()`), // Устанавливает текущее время при создании записи
});

export const order = pgTable('order', {
  id: serial('id').primaryKey(),
  telegram_id: varchar('telegram_id', { length: 50 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 20 }).notNull(),
  description: text('description'),
  delivery: text('delivery'),
  items: jsonb('items').notNull(),
  status: varchar('status', { length: 32 }).notNull().default('new'),
  status_datetime: timestamp('status_datetime')
    .notNull()
    .default(sql`now()`),
  datetime: timestamp('created_at')
    .notNull()
    .default(sql`now()`),
});

export const search_history = pgTable('search_history', {
  id: serial('id').primaryKey(),
  telegram_id: varchar('telegram_id', { length: 50 }).notNull(),
  query: varchar('query', { length: 255 }).notNull(),
  results_count: integer('results_count').notNull().default(0),
  datetime: timestamp('created_at')
    .notNull()
    .default(sql`now()`),
});

// Универсальные настройки бота: (category, key) -> value(JSON)
export const bot_settings = pgTable('bot_settings', {
  id: serial('id').primaryKey(),
  category: varchar('category', { length: 64 }).notNull(),
  key: varchar('key', { length: 128 }).notNull(),
  value: jsonb('value').notNull(),
  updated_at: timestamp('updated_at').notNull().default(sql`now()`),
  updated_by: varchar('updated_by', { length: 50 }), // telegram_id пользователя
});

// Аудит изменений настроек
export const settings_audit = pgTable('settings_audit', {
  id: serial('id').primaryKey(),
  category: varchar('category', { length: 64 }).notNull(),
  key: varchar('key', { length: 128 }).notNull(),
  old_value: jsonb('old_value'),
  new_value: jsonb('new_value').notNull(),
  updated_at: timestamp('updated_at').notNull().default(sql`now()`),
  updated_by: varchar('updated_by', { length: 50 }),
});
