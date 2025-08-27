export async function replySafe(ctx: any, text: string, extra?: any) {
  try {
    await ctx.reply(text, extra);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (/can't parse entities|wrong entity/i.test(msg)) {
      const fallback = { ...(extra || {}) };
      if (fallback && fallback.parse_mode) delete fallback.parse_mode;
      try {
        await ctx.reply(text);
      } catch (e2) {
        try {
          await ctx.reply(String(text), fallback);
        } catch (e3) {
          console.error('replySafe: не удалось отправить сообщение даже после фолбэка:', e3);
        }
      }
    } else {
      console.error('replySafe: ошибка отправки сообщения:', error);
    }
  }
}


