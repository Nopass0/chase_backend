import { Elysia, t } from "elysia";
import { db } from "@/db";
import {
  Prisma,
  Status,
  TransactionType,
  MethodType,
  Currency,
  RateSource,
} from "@prisma/client";
import ErrorSchema from "@/types/error";
import { randomBytes } from "node:crypto";
import { sha256 } from "@/utils/hash";
import { MASTER_KEY } from "@/utils/constants";

import merchantRoutes from "@/routes/admin/merchant";
import transactionsRoutes from "@/routes/admin/transactions";
import methodsRoutes from "@/routes/admin/merchant/methods";

const authHeader = t.Object({ "x-admin-key": t.String() });

export default (app: Elysia) =>
  app
    /* ───────────────── вложенные группы ───────────────── */
    .group("/merchant", (a) => merchantRoutes(a))
    .group("/merchant/methods", (a) => methodsRoutes(a))
    .group("/transactions", (a) => transactionsRoutes(a))

    /* ───────────────── enums ───────────────── */
    .get("/enums/status", () => Object.values(Status), {
      tags: ["admin"],
      headers: authHeader,
      response: {
        200: t.Array(t.Enum(Status)),
        401: ErrorSchema,
        403: ErrorSchema,
      },
    })
    .get("/enums/transaction-type", () => Object.values(TransactionType), {
      tags: ["admin"],
      headers: authHeader,
      response: {
        200: t.Array(t.Enum(TransactionType)),
        401: ErrorSchema,
        403: ErrorSchema,
      },
    })
    .get("/enums/method-type", () => Object.values(MethodType), {
      tags: ["admin"],
      headers: authHeader,
      response: {
        200: t.Array(t.Enum(MethodType)),
        401: ErrorSchema,
        403: ErrorSchema,
      },
    })
    .get("/enums/currency", () => Object.values(Currency), {
      tags: ["admin"],
      headers: authHeader,
      response: {
        200: t.Array(t.Enum(Currency)),
        401: ErrorSchema,
        403: ErrorSchema,
      },
    })
    .get("/enums/rate-source", () => Object.values(RateSource), {
      tags: ["admin"],
      headers: authHeader,
      response: {
        200: t.Array(t.Enum(RateSource)),
        401: ErrorSchema,
        403: ErrorSchema,
      },
    })
    .get(
      "/enums/all",
      () => ({
        status: Object.values(Status),
        transactionType: Object.values(TransactionType),
        methodType: Object.values(MethodType),
        currency: Object.values(Currency),
        rateSource: Object.values(RateSource),
      }),
      {
        tags: ["admin"],
        headers: authHeader,
        response: {
          200: t.Object({
            status: t.Array(t.Enum(Status)),
            transactionType: t.Array(t.Enum(TransactionType)),
            methodType: t.Array(t.Enum(MethodType)),
            currency: t.Array(t.Enum(Currency)),
            rateSource: t.Array(t.Enum(RateSource)),
          }),
          401: ErrorSchema,
          403: ErrorSchema,
        },
      },
    )

    /* ───────────────── stats ───────────────── */
    .get(
      "/stats",
      async () => ({ users: await db.user.count(), uptime: process.uptime() }),
      {
        tags: ["admin"],
        headers: authHeader,
        response: {
          200: t.Object({ users: t.Number(), uptime: t.Number() }),
          401: ErrorSchema,
          403: ErrorSchema,
        },
      },
    )

    /* ───────────────── user: ban ───────────────── */
    .post(
      "/ban-user",
      async ({ body, error }) => {
        try {
          await db.user.update({
            where: { id: body.id },
            data: { banned: true },
          });
          return { ok: true };
        } catch (e) {
          if (
            e instanceof Prisma.PrismaClientKnownRequestError &&
            e.code === "P2025"
          )
            return error(404, { error: "User not found" });
          throw e;
        }
      },
      {
        tags: ["admin"],
        headers: authHeader,
        body: t.Object({ id: t.String() }),
        response: {
          200: t.Object({ ok: t.Boolean() }),
          404: ErrorSchema,
          401: ErrorSchema,
          403: ErrorSchema,
        },
      },
    )

    /* ───────────────── user: create ───────────────── */
    .post(
      "/create-user",
      async ({ body, error }) => {
        try {
          const plain = randomBytes(8).toString("hex");
          const hash = await sha256(plain);

          const user = await db.user.create({
            data: {
              email: body.email,
              password: hash,
              name: body.name ?? "",
              balanceUsdt: body.balanceUsdt ?? 0,
              balanceRub: body.balanceRub ?? 0,
            },
            select: {
              id: true,
              email: true,
              name: true,
              balanceUsdt: true,
              balanceRub: true,
              createdAt: true,
            },
          });

          // Создаем TRC20 кошелек для пользователя
          // const wallet = await WalletService.createWalletForUser(user.id);

          const out = {
            ...user,
            createdAt: user.createdAt.toISOString(),
            plainPassword: plain,
          };
          return new Response(JSON.stringify(out), {
            status: 201,
            headers: { "Content-Type": "application/json" },
          });
        } catch (e) {
          if (
            e instanceof Prisma.PrismaClientKnownRequestError &&
            e.code === "P2002"
          )
            return error(409, {
              error: "Пользователь с таким email уже существует",
            });
          throw e;
        }
      },
      {
        tags: ["admin"],
        headers: authHeader,
        body: t.Object({
          email: t.String({ format: "email" }),
          name: t.Optional(t.String()),
          balanceUsdt: t.Optional(t.Number()),
          balanceRub: t.Optional(t.Number()),
        }),
        response: {
          201: t.Object({
            id: t.String(),
            email: t.String(),
            name: t.String(),
            balanceUsdt: t.Number(),
            balanceRub: t.Number(),
            createdAt: t.String(),
            plainPassword: t.String(),
            wallet: t.Object({
              id: t.String(),
              address: t.String(),
              isActive: t.Boolean(),
              createdAt: t.String(),
              updatedAt: t.String(),
            }),
          }),
          409: ErrorSchema,
          401: ErrorSchema,
          403: ErrorSchema,
        },
      },
    )

    /* ───────────────── user: delete ───────────────── */
    .delete(
      "/delete-user",
      async ({ body, error }) => {
        try {
          await db.user.delete({ where: { id: body.id } });
          return { ok: true };
        } catch (e) {
          if (
            e instanceof Prisma.PrismaClientKnownRequestError &&
            e.code === "P2025"
          )
            return error(404, { error: "Пользователь не найден" });
          throw e;
        }
      },
      {
        tags: ["admin"],
        headers: authHeader,
        body: t.Object({ id: t.String() }),
        response: {
          200: t.Object({ ok: t.Boolean() }),
          404: ErrorSchema,
          401: ErrorSchema,
          403: ErrorSchema,
        },
      },
    )

    /* ───────────────── user: regenerate password ───────────────── */
    .post(
      "/regenerate-password",
      async ({ body, error }) => {
        try {
          const plain = randomBytes(8).toString("hex");
          const hash = await sha256(plain);
          await db.user.update({
            where: { id: body.id },
            data: { password: hash },
          });
          return { ok: true, newPassword: plain };
        } catch (e) {
          if (
            e instanceof Prisma.PrismaClientKnownRequestError &&
            e.code === "P2025"
          )
            return error(404, { error: "Пользователь не найден" });
          throw e;
        }
      },
      {
        tags: ["admin"],
        headers: authHeader,
        body: t.Object({ id: t.String() }),
        response: {
          200: t.Object({ ok: t.Boolean(), newPassword: t.String() }),
          404: ErrorSchema,
          401: ErrorSchema,
          403: ErrorSchema,
        },
      },
    )

    /* ───────────────── user: update ───────────────── */
    .put(
      "/update-user",
      async ({ body, error }) => {
        try {
          const u = await db.user.update({
            where: { id: body.id },
            data: {
              email: body.email,
              name: body.name,
              balanceUsdt: body.balanceUsdt,
              balanceRub: body.balanceRub,
              banned: body.banned,
            },
            select: {
              id: true,
              email: true,
              name: true,
              balanceUsdt: true,
              balanceRub: true,
              banned: true,
              createdAt: true,
            },
          });
          return { ...u, createdAt: u.createdAt.toISOString() };
        } catch (e) {
          if (
            e instanceof Prisma.PrismaClientKnownRequestError &&
            e.code === "P2025"
          )
            return error(404, { error: "Пользователь не найден" });
          throw e;
        }
      },
      {
        tags: ["admin"],
        headers: authHeader,
        body: t.Object({
          id: t.String(),
          email: t.String({ format: "email" }),
          name: t.String(),
          balanceUsdt: t.Number(),
          balanceRub: t.Number(),
          banned: t.Boolean(),
        }),
        response: {
          200: t.Object({
            id: t.String(),
            email: t.String(),
            name: t.String(),
            balanceUsdt: t.Number(),
            balanceRub: t.Number(),
            banned: t.Boolean(),
            createdAt: t.String(),
          }),
          404: ErrorSchema,
          401: ErrorSchema,
          403: ErrorSchema,
        },
      },
    )

    /* ───────────────── users list ───────────────── */
    .get(
      "/users",
      async () => {
        const users = await db.user.findMany({
          select: {
            id: true,
            email: true,
            name: true,
            balanceUsdt: true,
            balanceRub: true,
            banned: true,
            createdAt: true,
          },
        });
        return users.map((u) => ({
          ...u,
          createdAt: u.createdAt.toISOString(),
        }));
      },
      {
        tags: ["admin"],
        headers: authHeader,
        response: {
          200: t.Array(
            t.Object({
              id: t.String(),
              email: t.String(),
              name: t.String(),
              balanceUsdt: t.Number(),
              balanceRub: t.Number(),
              banned: t.Boolean(),
              createdAt: t.String(),
            }),
          ),
          401: ErrorSchema,
          403: ErrorSchema,
        },
      },
    )

    /* ───────────────── user by id ───────────────── */
    .get(
      "/user/:id",
      async ({ params, error }) => {
        try {
          const u = await db.user.findUniqueOrThrow({
            where: { id: params.id },
            select: {
              id: true,
              email: true,
              name: true,
              balanceUsdt: true,
              balanceRub: true,
              banned: true,
              createdAt: true,
              sessions: {
                select: {
                  id: true,
                  ip: true,
                  createdAt: true,
                  expiredAt: true,
                },
              },
            },
          });
          return {
            ...u,
            createdAt: u.createdAt.toISOString(),
            sessions: u.sessions.map((s) => ({
              ...s,
              createdAt: s.createdAt.toISOString(),
              expiredAt: s.expiredAt.toISOString(),
            })),
          };
        } catch (e) {
          if (
            e instanceof Prisma.PrismaClientKnownRequestError &&
            e.code === "P2025"
          )
            return error(404, { error: "Пользователь не найден" });
          throw e;
        }
      },
      {
        tags: ["admin"],
        headers: authHeader,
        params: t.Object({ id: t.String() }),
        response: {
          200: t.Object({
            id: t.String(),
            email: t.String(),
            name: t.String(),
            balanceUsdt: t.Number(),
            balanceRub: t.Number(),
            banned: t.Boolean(),
            createdAt: t.String(),
            sessions: t.Array(
              t.Object({
                id: t.String(),
                ip: t.String(),
                createdAt: t.String(),
                expiredAt: t.String(),
              }),
            ),
          }),
          404: ErrorSchema,
          401: ErrorSchema,
          403: ErrorSchema,
        },
      },
    )

    /* ───────────────── superadmin: create ───────────────── */
    .post(
      "/create-admin",
      async ({ request, error }) => {
        if (request.headers.get("x-admin-key") !== MASTER_KEY)
          return error(401, { error: "Super-admin privileges required" });

        const token = randomBytes(32).toString("hex");
        const a = await db.admin.create({
          data: { token },
          select: { id: true, token: true, createdAt: true },
        });

        const out = { ...a, createdAt: a.createdAt.toISOString() };
        return new Response(JSON.stringify(out), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        });
      },
      {
        tags: ["superadmin"],
        headers: authHeader,
        response: {
          201: t.Object({
            id: t.String(),
            token: t.String(),
            createdAt: t.String(),
          }),
          409: ErrorSchema,
          401: ErrorSchema,
          403: ErrorSchema,
        },
      },
    )

    /* ───────────────── superadmin: delete ───────────────── */
    .delete(
      "/delete-admin",
      async ({ body, request, error }) => {
        if (request.headers.get("x-admin-key") !== MASTER_KEY)
          return error(401, { error: "Super-admin privileges required" });
        try {
          await db.admin.delete({ where: { id: body.id } });
          return { ok: true };
        } catch (e) {
          if (
            e instanceof Prisma.PrismaClientKnownRequestError &&
            e.code === "P2025"
          )
            return error(404, { error: "Admin not found" });
          throw e;
        }
      },
      {
        tags: ["superadmin"],
        headers: authHeader,
        body: t.Object({ id: t.String() }),
        response: {
          200: t.Object({ ok: t.Boolean() }),
          404: ErrorSchema,
          401: ErrorSchema,
          403: ErrorSchema,
        },
      },
    );
