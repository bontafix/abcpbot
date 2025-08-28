CREATE TABLE IF NOT EXISTS settings_audit (
  id SERIAL PRIMARY KEY,
  category VARCHAR(64) NOT NULL,
  key VARCHAR(128) NOT NULL,
  old_value JSONB,
  new_value JSONB NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_by VARCHAR(50)
);

