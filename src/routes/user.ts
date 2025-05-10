import { Elysia, t } from "elysia";
import { db } from "@/db";
import { sha256 } from "@/utils/hash";
import { randomBytes } from "node:crypto";
import ErrorSchema from "@/types/error";
import type { User as UserModel } from "@prisma/client";

/* --------------------------------------------------------------------------
 *  Расширяем контекст Elysia, чтобы TypeScript «знал» о поле ctx.user
 * ------------------------------------------------------------------------*/
declare module "elysia" {
  interface Context {
    user: UserModel;
  }
}

/* --------------------------------------------------------------------------
 *  Унифицированная схема открытых полей пользователя
 * ------------------------------------------------------------------------*/
const UserPublic = t.Object({
  id: t.String(),
  email: t.String(),
  name: t.String(),
  balanceUsdt: t.Number(),
  balanceRub: t.Number(),
  createdAt: t.String(),
});

/* --------------------------------------------------------------------------
 * Схема ответа при авторизации
 * ------------------------------------------------------------------------*/
const AuthResponseSchema = t.Object({
  token: t.String({
    description: "Токен для заголовка x-trader-token (действует 30 дней)",
  }),
  id: t.String(),
  email: t.String(),
  name: t.String(),
  balanceUsdt: t.Number(),
  balanceRub: t.Number(),
  createdAt: t.String(),
});

/* --------------------------------------------------------------------------
 *  Guard для всех защищённых эндпоинтов
 * ------------------------------------------------------------------------*/
const authGuard = {
  headers: t.Object({
    "x-trader-token": t.String({
      description: "Токен сессии пользователя для аутентификации",
    }),
  }),

  /* ----- Валидация токена, при ошибке — мгновенный ответ ----- */
  beforeHandle: async ({ headers, error }) => {
    const token = headers["x-trader-token"];

    const session = await db.session.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!session) return error(401, { error: "Сессия не найдена" });
    if (new Date() > session.expiredAt)
      return error(401, { error: "Сессия истекла" });
    if (session.user.banned)
      return error(403, { error: "Пользователь заблокирован" });
  },

  /* ----- Если всё ок — кладём пользователя в контекст ----- */
  resolve: async ({ headers }) => {
    const token = headers["x-trader-token"];
    const session = await db.session.findUnique({
      where: { token },
      include: { user: true },
    });

    /* session точно есть, т.к. beforeHandle пропустил нас дальше */
    return { user: session!.user };
  },
};

/* --------------------------------------------------------------------------
 *  Основной плагин /user
 * ------------------------------------------------------------------------*/
export default (app: Elysia) =>
  app
    /* ───────── POST /user/auth (публичный) ───────── */
    .post(
      "/auth",
      async ({ body, request, error }) => {
        const user = await db.user.findUnique({
          where: { email: body.email },
        });

        if (!user || user.password !== (await sha256(body.password)))
          return error(401, { error: "Неверные учетные данные" });
        if (user.banned)
          return error(403, { error: "Пользователь заблокирован" });

        const token = randomBytes(32).toString("hex");
        const ip = request.headers.get("x-forwarded-for") ?? "unknown";

        const session = await db.session.create({
          data: {
            token,
            ip,
            userId: user.id,
            expiredAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // +30 дней
          },
        });

        return {
          token: session.token,
          id: user.id,
          email: user.email,
          name: user.name,
          balanceUsdt: user.balanceUsdt,
          balanceRub: user.balanceRub,
          createdAt: user.createdAt.toISOString(),
        };
      },
      {
        tags: ["user"],
        detail: { summary: "Авторизация пользователя и получение токена" },
        body: t.Object({
          email: t.String({ format: "email", description: "Email пользователя" }),
          password: t.String({ description: "Пароль пользователя" }),
        }),
        response: {
          200: AuthResponseSchema,
          401: ErrorSchema,
          403: ErrorSchema,
        },
      },
    )

    /* ───────── Все маршруты ниже защищены authGuard ───────── */
    .guard(authGuard, (app) =>
      app
        /* ───────── GET /user/me ───────── */
        .get(
          "/me",
          ({ user }) => ({
            id: user.id,
            email: user.email,
            name: user.name,
            balanceUsdt: user.balanceUsdt,
            balanceRub: user.balanceRub,
            createdAt: user.createdAt.toISOString(),
          }),
          {
            tags: ["user"],
            detail: { summary: "Текущий пользователь" },
            response: {
              200: UserPublic,
              401: ErrorSchema,
              403: ErrorSchema,
            },
          },
        )

        /* ───────── GET /user/balance ───────── */
        .get(
          "/balance",
          ({ user }) => ({
            id: user.id,
            email: user.email,
            name: user.name,
            balanceUsdt: user.balanceUsdt,
            balanceRub: user.balanceRub,
            createdAt: user.createdAt.toISOString(),
          }),
          {
            tags: ["user"],
            detail: { summary: "Баланс пользователя" },
            response: {
              200: UserPublic,
              401: ErrorSchema,
              403: ErrorSchema,
            },
          },
        )

        /* ───────── GET /user/sessions ───────── */
        .get(
          "/sessions",
          async ({ user }) =>
            db.session.findMany({
              where: { userId: user.id },
              select: {
                id: true,
                token: true,
                ip: true,
                createdAt: true,
                expiredAt: true,
              },
              orderBy: { createdAt: "desc" },
            }),
          {
            tags: ["user"],
            detail: { summary: "Список всех сессий пользователя" },
            response: {
              200: t.Array(
                t.Object({
                  id: t.String(),
                  token: t.String(),
                  ip: t.String(),
                  createdAt: t.String(),
                  expiredAt: t.String(),
                }),
              ),
              401: ErrorSchema,
              403: ErrorSchema,
            },
          },
        )

        /* ───────── DELETE /user/sessions/:id ───────── */
        .delete(
          "/sessions/:id",
          async ({ params, user, error }) => {
            const deleted = await db.session.deleteMany({
              where: { id: params.id, userId: user.id },
            });

            if (deleted.count === 0)
              return error(404, { error: "Сессия не найдена" });

            return { ok: true };
          },
          {
            tags: ["user"],
            detail: { summary: "Удалить сессию по ID" },
            params: t.Object({
              id: t.String({ description: "ID сессии" }),
            }),
            response: {
              200: t.Object({ ok: t.Boolean() }),
              404: ErrorSchema,
              401: ErrorSchema,
              403: ErrorSchema,
            },
          },
        )

        /* ───────── DELETE /user/sessions ───────── */
        .delete(
          "/sessions",
          async ({ headers, user }) => {
            const currentToken = headers["x-trader-token"];

            await db.session.deleteMany({
              where: {
                userId: user.id,
                token: { not: currentToken },
              },
            });

            return { ok: true };
          },
          {
            tags: ["user"],
            detail: {
              summary: "Удалить все сессии, кроме текущей",
            },
            response: {
              200: t.Object({ ok: t.Boolean() }),
              401: ErrorSchema,
              403: ErrorSchema,
            },
          },
        ),
    );