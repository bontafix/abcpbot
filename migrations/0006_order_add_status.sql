ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "status" varchar(32) NOT NULL DEFAULT 'new';
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "status_datetime" timestamp NOT NULL DEFAULT now();

