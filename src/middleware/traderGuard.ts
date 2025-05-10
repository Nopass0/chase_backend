import { Elysia, t } from "elysia";
import { db } from "@/db";
import type { User as UserModel } from "@prisma/client";
import ErrorSchema from "@/types/error";

/**
 * traderGuard — middleware-защита для эндпоинтов трейдера.
 *
 * Ошибки, которые может вернуть guard:
 *  • **401 Сессия не найдена** — в заголовке `x-trader-token` отсутствует действительный токен сессии.
 *  • **401 Сессия истекла** — токен сессии истек.
 *  • **403 Пользователь заблокирован** — пользователь заблокирован администратором.
 *  • **403 Трафик отключен** — трафик для пользователя отключен администратором.
 */

/* --------------------------------------------------------------------------
 *  Расширяем контекст Elysia, чтобы TypeScript «знал» о поле ctx.trader
 * ------------------------------------------------------------------------*/
declare module "elysia" {
  interface Context {
    trader: UserModel;
  }
}

export const traderGuard = () => (app: Elysia) =>
  app
    /* 1. Схема заголовка + базовая проверка */
    .guard({
      headers: t.Object({
        "x-trader-token": t.String({
          description: "Токен сессии трейдера для аутентификации",
        }),
      }),
      async beforeHandle({ headers, error }) {
        const token = headers["x-trader-token"];
        
        if (!token) {
          return error(401, { error: "Токен не предоставлен" });
        }

        const session = await db.session.findUnique({
          where: { token },
          include: { user: true },
        });

        if (!session) return error(401, { error: "Сессия не найдена" });
        if (new Date() > session.expiredAt)
          return error(401, { error: "Сессия истекла" });
        if (session.user.banned)
          return error(403, { error: "Пользователь заблокирован" });
        if (!session.user.trafficEnabled)
          return error(403, { error: "Трафик отключен" });
      },
      response: {
        401: ErrorSchema,
        403: ErrorSchema,
      },
    })

    /* 2. Добавляем трейдера в контекст */
    .derive(async ({ headers }) => {
      const token = headers["x-trader-token"];
      // Ensure token is not undefined before querying
      if (!token) {
        throw new Error("Token is required for trader authentication");
      }
      
      const session = await db.session.findUnique({
        where: { token },
        include: { user: true },
      });

      /* session точно есть, т.к. beforeHandle пропустил нас дальше */
      if (!session || !session.user) {
        throw new Error("Session or user not found");
      }
      
      return { trader: session.user };
    });