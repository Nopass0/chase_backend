// src/middleware/merchantGuard.ts
import { Elysia, t } from 'elysia';
import { db } from '@/db';

/**
 * merchantGuard — защита «продавец-эндпоинтов».
 *
 * Ошибки:
 *  • 401 Invalid merchant key — нет/неверный `x-merchant-api-key`.
 *
 * Использование:
 *   app.use(merchantGuard())                 // глобально
 *   app.use('/merchant', merchantGuard())    // для группы /merchant
 */
export const merchantGuard =
  () => (app: Elysia) =>
    app
      /* 1. Схема заголовка + базовая проверка */
      .guard({
        headers: t.Object({
          'x-merchant-api-key': t.String({
            description: 'API-ключ мерчанта',
          }),
        }),
        async beforeHandle({ headers, error }) {
          // быстрая валидация: есть ли мерчант с таким токеном
          const exists = await db.merchant.findFirst({
            where: { token: headers['x-merchant-api-key'] },
            select: { id: true },          // только факт существования
          });
          if (!exists)
            return error(401, { error: 'Invalid merchant key' });

          /* ничего не возвращаем → основной handler выполняется */
        },
      })

      /* 2. Добавляем мерчанта в контекст */
      .derive(async ({ headers, error }) => {
        const merchant = await db.merchant.findUnique({
          where: { token: headers['x-merchant-api-key'] },
        });
        if (!merchant)
          return error(401, { error: 'Invalid merchant key' });

        /* теперь в handlers доступно { merchant } */
        return { merchant };
      });
