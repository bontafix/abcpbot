export type ValidationResult<T> = { ok: true; value: T } | { ok: false; error: string };

export function isNonEmptyString(input: unknown): input is string {
  return typeof input === 'string' && input.trim().length > 0;
}

export function validatePhone(input: string): ValidationResult<string> {
  const v = String(input || '').trim();
  if (!/^\+?\d[\d\s\-()]{6,}$/.test(v)) {
    return { ok: false, error: 'Неверный формат телефона' };
  }
  return { ok: true, value: v.replace(/\s+/g, '') };
}

export function validateTelegramId(input: string): ValidationResult<string> {
  const v = String(input || '').trim();
  if (!/^[0-9]{5,12}$/.test(v)) {
    return { ok: false, error: 'Telegram ID должен быть числом (5-12 цифр)' };
  }
  return { ok: true, value: v };
}

export function validateUrl(input: string): ValidationResult<string> {
  const v = String(input || '').trim();
  try {
    const u = new URL(v);
    return { ok: true, value: u.toString() };
  } catch {
    return { ok: false, error: 'Неверный URL' };
  }
}

export function validatePositiveInt(input: string): ValidationResult<number> {
  const v = Number(String(input || '').trim());
  if (!Number.isInteger(v) || v <= 0) {
    return { ok: false, error: 'Введите положительное целое число' };
  }
  return { ok: true, value: v };
}

// Схемы полей по категориям
export type ManagerSettings = {
  phone?: string;
  telegram_user_id?: string;
  display_name?: string;
};

export type AbcpSettings = {
  base_url?: string; // из БД — только не секреты
  timeout_ms?: number;
};

export type BankSettings = {
  account?: string;
  bik?: string;
  inn?: string;
  kpp?: string;
  recipient?: string;
  bank_name?: string;
};

export const ManagerFieldOrder: Array<keyof ManagerSettings> = ['phone', 'telegram_user_id', 'display_name'];
export const AbcpFieldOrder: Array<keyof AbcpSettings> = ['base_url', 'timeout_ms'];
export const BankFieldOrder: Array<keyof BankSettings> = ['account', 'bik', 'inn', 'kpp', 'recipient', 'bank_name'];

export function validateManagerField(field: keyof ManagerSettings, value: string): ValidationResult<string> {
  if (field === 'phone') return validatePhone(value);
  if (field === 'telegram_user_id') return validateTelegramId(value);
  if (field === 'display_name') return isNonEmptyString(value) ? { ok: true, value: value.trim() } : { ok: false, error: 'Имя не должно быть пустым' };
  return { ok: false, error: 'Неизвестное поле' };
}

export function validateAbcpField(field: keyof AbcpSettings, value: string): ValidationResult<string | number> {
  if (field === 'base_url') return validateUrl(value);
  if (field === 'timeout_ms') return validatePositiveInt(value);
  return { ok: false, error: 'Неизвестное поле' };
}

export function validateBankField(field: keyof BankSettings, value: string): ValidationResult<string> {
  const v = String(value || '').trim();
  if (!isNonEmptyString(v)) return { ok: false, error: 'Поле не должно быть пустым' };
  return { ok: true, value: v };
}


