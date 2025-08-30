export async function showAdminHeader(ctx: any, title: string) {
  try {
    const prevId = ctx.session?.adminHeaderMessageId;
    if (prevId) {
      try { await ctx.deleteMessage(prevId); } catch {}
    }
    const text = `🛡️ ${title}\nВы находитесь в режиме администратора.`;
    const msg = await ctx.reply(text);
    if (msg && msg.message_id && ctx.session) {
      ctx.session.adminHeaderMessageId = msg.message_id;
    }
  } catch {}
}

export async function clearAdminHeader(ctx: any) {
  try {
    const prevId = ctx.session?.adminHeaderMessageId;
    if (prevId) {
      try { await ctx.deleteMessage(prevId); } catch {}
    }
    if (ctx.session) {
      ctx.session.adminHeaderMessageId = undefined;
    }
  } catch {}
}

export async function deleteUserMessage(ctx: any) {
  try {
    if (ctx.message && 'message_id' in ctx.message) {
      await ctx.deleteMessage();
    }
  } catch {}
}



