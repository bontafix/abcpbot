import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import { client } from './models';
import { sql } from 'drizzle-orm';
import * as path from 'path';
import * as fs from 'fs';

import { loadEnv } from './config/env';
loadEnv();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
 
});

export const db = drizzle(pool);

// Автоматическое выполнение миграций
(async () => {
  const migrationsFolder = path.resolve(__dirname, '..', 'migrations');
  console.log('Checking for migrations...');
  console.log('Migrations folder:', migrationsFolder);
  try {
    const files = fs.readdirSync(migrationsFolder).filter(f => f.endsWith('.sql'));
    console.log('Found migration files:', files);
  } catch (e) {
    console.error('Failed to read migrations folder', e);
  }
  await migrate(db, { migrationsFolder });
  console.log('Migrations applied successfully.');

  // Подробная верификация схемы и fallback
  async function tableExists(tableName: string): Promise<boolean> {
    const q = await pool.query("select to_regclass($1) as rel", [
      `public.${tableName}`,
    ]);
    return Boolean(q?.rows?.[0]?.rel);
  }

  async function columnExists(tableName: string, columnName: string): Promise<boolean> {
    const q = await pool.query(
      'select 1 from information_schema.columns where table_schema=$1 and table_name=$2 and column_name=$3',
      ['public', tableName, columnName]
    );
    return (q?.rows?.length ?? 0) > 0;
  }

  async function indexExists(indexName: string): Promise<boolean> {
    const q = await pool.query('select to_regclass($1) as idx', [indexName]);
    return Boolean(q?.rows?.[0]?.idx);
  }

  async function verifyAndReport(): Promise<{ ok: boolean }> {
    console.log('=== Schema verification start ===');
    let ok = true;
    const checks: Array<{
      kind: 'table' | 'column' | 'index';
      target: string;
      table?: string;
    }> = [];

    // Tables
    ['user', 'service', 'client', 'order', 'bot_settings', 'settings_audit', 'search_history'].forEach(t => checks.push({ kind: 'table', target: t }));

    // Critical columns
    [
      ['order', 'items'],
      ['order', 'name'],
      ['order', 'phone'],
      ['order', 'status'],
      ['order', 'status_datetime'],
      ['order', 'delivery'],
      ['client', 'telegram_id'],
      ['client', 'phone'],
      ['client', 'name'],
    ].forEach(([t, c]) => checks.push({ kind: 'column', target: c, table: t }));

    // Indexes
    ['client_telegram_id_unique', 'order_telegram_id_idx', 'bot_settings_category_key_uq', 'search_history_telegram_id_idx']
      .forEach(i => checks.push({ kind: 'index', target: i }));

    for (const c of checks) {
      try {
        if (c.kind === 'table') {
          const exists = await tableExists(c.target);
          console.log(`[TABLE] ${c.target}: ${exists ? 'OK' : 'MISSING'}`);
          if (!exists) ok = false;
        } else if (c.kind === 'column' && c.table) {
          const exists = await columnExists(c.table, c.target);
          console.log(`[COLUMN] ${c.table}.${c.target}: ${exists ? 'OK' : 'MISSING'}`);
          if (!exists) ok = false;
        } else if (c.kind === 'index') {
          const exists = await indexExists(c.target);
          console.log(`[INDEX] ${c.target}: ${exists ? 'OK' : 'MISSING'}`);
          if (!exists) ok = false;
        }
      } catch (e) {
        ok = false;
        console.error('Check failed:', c, e);
      }
    }
    console.log('=== Schema verification end ===');
    return { ok };
  }

  let verify = await verifyAndReport();
  if (!verify.ok) {
    try {
      const baselinePath = path.resolve(migrationsFolder, '0010_baseline_full_schema.sql');
      console.log('Applying baseline schema:', baselinePath);
      const sqlText = fs.readFileSync(baselinePath, 'utf8');
      await pool.query(sqlText);
      console.log('Baseline schema applied. Re-verifying...');
      verify = await verifyAndReport();
      if (!verify.ok) {
        console.error('Schema verification still failing after baseline application.');
      }
    } catch (e) {
      console.error('Failed to apply baseline schema:', e);
    }
  }

  // Гарантируем наличие новой колонки доставки, даже если мигратор не сработал
  try {
    const check = await pool.query("select to_regclass('public.order') as rel");
    const tableExists = Boolean(check?.rows?.[0]?.rel);
    if (tableExists) {
      await pool.query('ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "delivery" text');
      console.log('Ensure: column "delivery" exists on table "order"');
    } else {
      console.log('Ensure skipped: table "order" does not exist yet');
    }
  } catch (e) {
    console.error('Ensure delivery column failed:', e);
  }
  
})();

export async function saveClientData(telegramId: string, phone: string, name: string) {
  try {
    await db.insert(client).values({ telegram_id: telegramId, phone, name });
    console.log('Client data saved successfully.');
  } catch (error) {
    console.error('Error saving client data:', error);
  }
}
