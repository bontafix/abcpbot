ALTER TABLE "search_history" ADD COLUMN IF NOT EXISTS "results_count" integer NOT NULL DEFAULT 0;

