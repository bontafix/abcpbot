import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import { client } from './models';

// dotenv.config();
const envFile = process.env.NODE_ENV === 'production' ? '.env.prod' : '.env.dev';
dotenv.config({ path: envFile });

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

export async function saveClientData(name: string, phoneNumber: string) {
  try {
    await db.insert(client).values({ name, phoneNumber });
    console.log('Client data saved successfully.');
  } catch (error) {
    console.error('Error saving client data:', error);
  }
}
