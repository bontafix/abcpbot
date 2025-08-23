export type OrderStatus = 'new' | 'in_progress' | 'rejected' | 'completed' | 'reserved';

// Базовая матрица переходов статусов для клиента.
// По умолчанию разрешаем только отказ от незавершённых заказов.
// Остальные переходы можно будет добавлять здесь позже.
const ALLOWED_TRANSITIONS: Record<OrderStatus, ReadonlyArray<OrderStatus>> = {
  new: ['rejected'],
  in_progress: ['rejected'],
  reserved: ['rejected'],
  completed: [],
  rejected: [],
};

// Переходы для администратора. Можно расширять по мере необходимости.
const ADMIN_TRANSITIONS: Record<OrderStatus, ReadonlyArray<OrderStatus>> = {
  new: ['in_progress', 'reserved', 'completed', 'rejected'],
  in_progress: ['reserved', 'completed', 'rejected'],
  reserved: ['in_progress', 'completed', 'rejected'],
  completed: [],
  rejected: [],
};

export function canTransitionStatus(current: string, target: string): boolean {
  const c = (current || '').toLowerCase() as OrderStatus;
  const t = (target || '').toLowerCase() as OrderStatus;
  if (!isKnownStatus(c) || !isKnownStatus(t)) return false;
  return (ALLOWED_TRANSITIONS[c] || []).includes(t);
}

export function canDeleteByStatus(current: string): boolean {
  const c = (current || '').toLowerCase() as OrderStatus;
  if (!isKnownStatus(c)) return false;
  return c === 'rejected';
}

export function isKnownStatus(s: string): s is OrderStatus {
  const k = (s || '').toLowerCase();
  return k === 'new' || k === 'in_progress' || k === 'rejected' || k === 'completed' || k === 'reserved';
}

export function canTransitionStatusAdmin(current: string, target: string): boolean {
  const c = (current || '').toLowerCase() as OrderStatus;
  const t = (target || '').toLowerCase() as OrderStatus;
  if (!isKnownStatus(c) || !isKnownStatus(t)) return false;
  return (ADMIN_TRANSITIONS[c] || []).includes(t);
}


