import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

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
