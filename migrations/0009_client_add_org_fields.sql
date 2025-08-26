ALTER TABLE "client"
  ADD COLUMN IF NOT EXISTS "org_inn" varchar(12),
  ADD COLUMN IF NOT EXISTS "org_title" varchar(255),
  ADD COLUMN IF NOT EXISTS "org_ogrn" varchar(15),
  ADD COLUMN IF NOT EXISTS "org_address" text;


