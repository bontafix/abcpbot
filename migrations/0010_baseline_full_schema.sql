-- Baseline full schema (idempotent)
-- Users
CREATE TABLE IF NOT EXISTS "user" (
  "id" serial PRIMARY KEY NOT NULL,
  "inn" varchar(12) NOT NULL,
  "name" varchar(255) NOT NULL,
  "telegram_id" varchar(50) NOT NULL,
  "title" varchar(255),
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- Services
CREATE TABLE IF NOT EXISTS "service" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" varchar(255) NOT NULL,
  "unit" varchar(255) DEFAULT 'услуга' NOT NULL,
  "tax" varchar(20) DEFAULT 'без НДС' NOT NULL,
  "price" numeric NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- Clients
CREATE TABLE IF NOT EXISTS "client" (
  "id" serial PRIMARY KEY NOT NULL,
  "telegram_id" varchar(50) NOT NULL,
  "phone" varchar(20) NOT NULL,
  "name" varchar(255) NOT NULL,
  "address" text,
  "org_inn" varchar(12),
  "org_title" varchar(255),
  "org_ogrn" varchar(15),
  "org_address" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);
-- Ensure columns (if table existed earlier)
ALTER TABLE "client" ADD COLUMN IF NOT EXISTS "address" text;
ALTER TABLE "client" ADD COLUMN IF NOT EXISTS "org_inn" varchar(12);
ALTER TABLE "client" ADD COLUMN IF NOT EXISTS "org_title" varchar(255);
ALTER TABLE "client" ADD COLUMN IF NOT EXISTS "org_ogrn" varchar(15);
ALTER TABLE "client" ADD COLUMN IF NOT EXISTS "org_address" text;
-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS "client_telegram_id_unique" ON "client" ("telegram_id");

-- Orders
CREATE TABLE IF NOT EXISTS "order" (
  "id" serial PRIMARY KEY NOT NULL,
  "telegram_id" varchar(50) NOT NULL,
  "name" varchar(255) NOT NULL,
  "phone" varchar(20) NOT NULL,
  "description" text,
  "delivery" text,
  "items" jsonb NOT NULL,
  "status" varchar(32) NOT NULL DEFAULT 'new',
  "status_datetime" timestamp NOT NULL DEFAULT now(),
  "created_at" timestamp DEFAULT now() NOT NULL
);
-- Ensure columns
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "name" varchar(255) NOT NULL DEFAULT '';
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "phone" varchar(20) NOT NULL DEFAULT '';
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "status" varchar(32) NOT NULL DEFAULT 'new';
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "status_datetime" timestamp NOT NULL DEFAULT now();
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "delivery" text;
-- Indexes
CREATE INDEX IF NOT EXISTS "order_telegram_id_idx" ON "order" ("telegram_id");

-- Bot settings
CREATE TABLE IF NOT EXISTS bot_settings (
  id SERIAL PRIMARY KEY,
  category VARCHAR(64) NOT NULL,
  key VARCHAR(128) NOT NULL,
  value JSONB NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_by VARCHAR(50)
);
CREATE UNIQUE INDEX IF NOT EXISTS bot_settings_category_key_uq ON bot_settings (category, key);

-- Settings audit
CREATE TABLE IF NOT EXISTS settings_audit (
  id SERIAL PRIMARY KEY,
  category VARCHAR(64) NOT NULL,
  key VARCHAR(128) NOT NULL,
  old_value JSONB,
  new_value JSONB NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_by VARCHAR(50)
);

-- Search history
CREATE TABLE IF NOT EXISTS "search_history" (
  "id" serial PRIMARY KEY NOT NULL,
  "telegram_id" varchar(50) NOT NULL,
  "query" varchar(255) NOT NULL,
  "results_count" integer NOT NULL DEFAULT 0,
  "created_at" timestamp DEFAULT now() NOT NULL
);
ALTER TABLE "search_history" ADD COLUMN IF NOT EXISTS "results_count" integer NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS "search_history_telegram_id_idx" ON "search_history" ("telegram_id");


