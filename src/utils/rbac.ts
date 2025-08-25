import { MiddlewareFn } from 'telegraf';

export type Role = 'admin' | 'client';

function getAdminIdsFromEnv(): Set<string> {
  const raw = process.env.ADMIN_IDS || '';
  return new Set(
    raw
      .split(',')
      .map((v) => v.trim())
      .filter((v) => v.length > 0)
  );
}

export function getUserRoles(telegramId?: string): Role[] {
  const adminIds = getAdminIdsFromEnv();
  if (telegramId && adminIds.has(telegramId)) {
    return ['admin', 'client'];
  }
  return ['client'];
}

export const attachRoles: MiddlewareFn<any> = async (ctx, next) => {
  const telegramId = ctx.from?.id ? String(ctx.from.id) : undefined;
  const roles = getUserRoles(telegramId);
  (ctx as any).state = (ctx as any).state || {};
  (ctx as any).state.roles = roles;
  console.log(`Прикреплены роли для ${telegramId}:`, roles);
  return next();
};

export const requireRole = (allowed: Role[]): MiddlewareFn<any> => {
  return async (ctx, next) => {
    const roles: Role[] = (((ctx as any).state && (ctx as any).state.roles) || getUserRoles(ctx.from?.id ? String(ctx.from.id) : undefined));
    const permitted = roles.some((r) => allowed.includes(r));
    console.log(`requireRole: ${allowed.join(',')}, доступные: ${roles.join(',')}, разрешено: ${permitted}`);
    if (!permitted) {
      if (ctx.callbackQuery) {
        try {
          // @ts-ignore
          await ctx.answerCbQuery('Нет доступа');
        } catch {}
      } else {
        try {
          await ctx.reply('Недостаточно прав для выполнения команды.');
        } catch {}
      }
      return;
    }
    return next();
  };
};


