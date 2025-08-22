CREATE TABLE IF NOT EXISTS "client" (
  "id" serial PRIMARY KEY NOT NULL,
  "telegram_id" varchar(50) NOT NULL,
  "phone" varchar(20) NOT NULL,
  "name" varchar(255) NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "client_telegram_id_unique" ON "client" ("telegram_id");



