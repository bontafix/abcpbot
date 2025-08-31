export function normalizeMenuText(input: string | undefined | null): string {
  const value = String(input || '').trim();
  // Удаляем ведущие эмодзи/символы и пробелы до первой буквы/цифры
  const withoutLeading = value.replace(/^[^A-Za-zА-Яа-яЁё0-9]+/, '').trim();
  // Схлопываем повторные пробелы
  return withoutLeading.replace(/\s+/g, ' ').trim();
}

export function isOneOf(text: string, options: string[]): boolean {
  const norm = normalizeMenuText(text);
  return options.some((o) => normalizeMenuText(o) === norm);
}


