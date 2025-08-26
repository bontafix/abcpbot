import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';

const envFile = process.env.NODE_ENV === 'production' ? '.env.prod' : process.env.NODE_ENV === 'test' ? '.env.test' : '.env.dev';
dotenv.config({ path: envFile });

export default defineConfig({
  schema: './src/models.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: { 
    url: process.env.DATABASE_URL ?? '',
  },
});


