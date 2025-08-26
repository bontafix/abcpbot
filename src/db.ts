import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import { client } from './models';

import { loadEnv } from './config/env';
loadEnv();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
 
});

export const db = drizzle(pool);

// Автоматическое выполнение миграций
(async () => {
  console.log('Checking for migrations...');
  await migrate(db, { migrationsFolder: './migrations' });
  console.log('Migrations applied successfully.');
})();

export async function saveClientData(telegramId: string, phone: string, name: string) {
  try {
    await db.insert(client).values({ telegram_id: telegramId, phone, name });
    console.log('Client data saved successfully.');
  } catch (error) {
    console.error('Error saving client data:', error);
  }
}
