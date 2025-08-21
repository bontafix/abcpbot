import { Scenes } from 'telegraf';

// Универсальный контекст для совместимости
type AnyContext = Scenes.WizardContext & { scene: any; wizard: any };

interface OrderWizardState {
  brand?: string;
  number?: string;
  quantity?: number;
  deliveryMethod?: 'pickup' | 'delivery';
  address?: string;
  availability?: number;
}

const orderStep1 = async (ctx: AnyContext) => {
  const s = ctx.wizard.state as OrderWizardState;
  const sceneState = (ctx.scene.state || {}) as { brand?: string; number?: string; availability?: number };
  // Инициализируем из переданного state при enter
  s.brand = sceneState.brand;
  s.number = sceneState.number;
  s.availability = sceneState.availability;

  await ctx.reply(
    `Оформление заказа\nБрэнд: ${s.brand ?? '-'}\nАртикул: ${s.number ?? '-'}\nДоступно: ${s.availability ?? '-'}\n\nВведите количество:`
  );
  return ctx.wizard.next();
};

const orderStep2 = async (ctx: AnyContext) => {
  const s = ctx.wizard.state as OrderWizardState;

  if (ctx.message && 'text' in ctx.message) {
    const qtyRaw = (ctx.message.text || '').trim();
    const qty = Number(qtyRaw);
    if (!Number.isFinite(qty) || qty <= 0) {
      await ctx.reply('Укажите корректное положительное число.');
      return; // остаёмся на шаге 2
    }
    if (typeof s.availability === 'number' && qty > s.availability) {
      await ctx.reply(`Недостаточно на складе. Доступно: ${s.availability}. Укажите количество не больше.`);
      return; // остаёмся на шаге 2
    }
    s.quantity = qty;

    await ctx.reply('Выберите способ доставки:', {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Самовывоз', callback_data: 'delivery:pickup' }],
          [{ text: 'Доставка', callback_data: 'delivery:delivery' }],
        ],
      },
    });
    return ctx.wizard.next();
  }

  await ctx.reply('Введите количество числом.');
};

const orderStep3 = async (ctx: AnyContext) => {
  const s = ctx.wizard.state as OrderWizardState;

  if (ctx.callbackQuery && 'data' in ctx.callbackQuery) {
    const data = (ctx.callbackQuery as any).data as string;
    await ctx.answerCbQuery();

    if (data === 'delivery:pickup') {
      s.deliveryMethod = 'pickup';
      await ctx.reply(
        `Заказ принят:\nБрэнд: ${s.brand}\nАртикул: ${s.number}\nКоличество: ${s.quantity}\nДоставка: Самовывоз`
      );
      return ctx.scene.leave();
    }

    if (data === 'delivery:delivery') {
      s.deliveryMethod = 'delivery';
      await ctx.reply('Введите адрес доставки:');
      return ctx.wizard.next();
    }
  }

  await ctx.reply('Выберите вариант: Самовывоз или Доставка.');
};

const orderStep4 = async (ctx: AnyContext) => {
  const s = ctx.wizard.state as OrderWizardState;

  if (ctx.message && 'text' in ctx.message) {
    const address = (ctx.message.text || '').trim();
    if (!address) {
      await ctx.reply('Пожалуйста, укажите адрес текстом.');
      return; // остаёмся на шаге 4
    }
    s.address = address;

    await ctx.reply(
      `Заказ принят:\nБрэнд: ${s.brand}\nАртикул: ${s.number}\nКоличество: ${s.quantity}\nДоставка: Адрес\n${s.address}`
    );
    return ctx.scene.leave();
  }

  await ctx.reply('Введите адрес текстом.');
};

const orderScene = new Scenes.WizardScene<AnyContext>(
  'order',
  orderStep1,
  orderStep2,
  orderStep3,
  orderStep4
);

export default orderScene;
