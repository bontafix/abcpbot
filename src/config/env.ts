import * as dotenv from 'dotenv';

type EnvMode = 'development' | 'production' | 'test';

function getEnvFile(mode: EnvMode): string {
  if (mode === 'production') return '.env.prod';
  if (mode === 'test') return '.env.test';
  return '.env.dev';
}

export function loadEnv(): void {
  const nodeEnv = (process.env.NODE_ENV as EnvMode) || 'development';
  const envFile = getEnvFile(nodeEnv);
  dotenv.config({ path: envFile });
}

export function requireEnv(keys: string[]): void {
  const missing = keys.filter((k) => !process.env[k] || String(process.env[k]).length === 0);
  if (missing.length) {
    throw new Error(`Отсутствуют переменные окружения: ${missing.join(', ')}`);
  }
}


