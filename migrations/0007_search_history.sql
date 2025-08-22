CREATE TABLE IF NOT EXISTS "search_history" (
  "id" serial PRIMARY KEY NOT NULL,
  "telegram_id" varchar(50) NOT NULL,
  "query" varchar(255) NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "search_history_telegram_id_idx" ON "search_history" ("telegram_id");

