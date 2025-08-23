// Преобразование availability:
// - положительное значение оставляем неизменным
// - отрицательное преобразуем в строку из '+' длиной |value|
export function transformAvailability(value: unknown): unknown {
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (value === -10) {
      return 'Под заказ';
    }
    if (value < 0) {
      const count = Math.max(0, Math.floor(Math.abs(value)));
      return '+'.repeat(count);
    }
    return value; // положительное/0 — без изменений
  }
  if (typeof value === 'string') {
    const n = Number(value);
    if (Number.isFinite(n) && n < 0) {
      if (n === -10) {
        return 'Под заказ';
      }
      const count = Math.max(0, Math.floor(Math.abs(n)));
      return '+'.repeat(count);
    }
    return value; // строки с неотрицательным числом или ненаumeric — без изменений
  }
  return value;
}


