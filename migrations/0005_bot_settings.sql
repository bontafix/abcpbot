CREATE TABLE IF NOT EXISTS bot_settings (
  id SERIAL PRIMARY KEY,
  category VARCHAR(64) NOT NULL,
  key VARCHAR(128) NOT NULL,
  value JSONB NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_by VARCHAR(50)
);

CREATE UNIQUE INDEX IF NOT EXISTS bot_settings_category_key_uq
  ON bot_settings (category, key);

