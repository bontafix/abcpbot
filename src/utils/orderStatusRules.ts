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

// Переходы для администратора: разрешаем любой статус → любой другой статус
const ADMIN_TRANSITIONS: Record<OrderStatus, ReadonlyArray<OrderStatus>> = {
  new: ['new', 'in_progress', 'rejected', 'completed', 'reserved'],
  in_progress: ['new', 'in_progress', 'rejected', 'completed', 'reserved'],
  reserved: ['new', 'in_progress', 'rejected', 'completed', 'reserved'],
  completed: ['new', 'in_progress', 'rejected', 'completed', 'reserved'],
  rejected: ['new', 'in_progress', 'rejected', 'completed', 'reserved'],
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
  console.log('canTransitionStatusAdmin', current, target);
  const c = (current || '').toLowerCase() as OrderStatus;
  const t = (target || '').toLowerCase() as OrderStatus;
  if (!isKnownStatus(c) || !isKnownStatus(t)) return false;
  console.log('ADMIN_TRANSITIONS', ADMIN_TRANSITIONS[c], t);
  return (ADMIN_TRANSITIONS[c] || []).includes(t);
}


