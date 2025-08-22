CREATE TABLE IF NOT EXISTS "order" (
  "id" serial PRIMARY KEY NOT NULL,
  "telegram_id" varchar(50) NOT NULL,
  "description" text,
  "items" jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "order_telegram_id_idx" ON "order" ("telegram_id");

