import { pgTable, serial, text, bigint, varchar, numeric, timestamp } from 'drizzle-orm/pg-core';
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
  name: varchar('name', { length: 255 }).notNull(),
  phoneNumber: varchar('phone_number', { length: 20 }).notNull(),
  createdAt: timestamp('created_at')
    .notNull()
    .default(sql`now()`), // Устанавливает текущее время при создании записи
});
