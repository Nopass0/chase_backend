// src/server/routes/trader/bank-details.ts  (полный рабочий файл)
import { Elysia, t } from "elysia";
import { db } from "@/db";
import { BankType, Status } from "@prisma/client";
import ErrorSchema from "@/types/error";
import { startOfDay, endOfDay } from "date-fns";

/* ---------- DTO (то же, без userId) ---------- */
const BankDetailDTO = t.Object({
  id: t.String(),
  methodType: t.String(),
  bankType: t.String(),
  cardNumber: t.String(),
  recipientName: t.String(),
  phoneNumber: t.Optional(t.String()),
  minAmount: t.Number(),
  maxAmount: t.Number(),
  dailyLimit: t.Number(),
  monthlyLimit: t.Number(),
  intervalMinutes: t.Number(),
  turnoverDay: t.Number(),
  turnoverTotal: t.Number(),
  isArchived: t.Boolean(),
  createdAt: t.String(),
  updatedAt: t.String(),
});

/* ---------- helper ---------- */
const toDTO = (
  r: any,
  turnoverDay = 0,
  turnoverTotal = 0,
): t.Static<typeof BankDetailDTO> => {
  const { userId, ...rest } = r; // ⚠️ убираем userId
  return {
    ...rest,
    turnoverDay,
    turnoverTotal,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
};

/* ---------- routes ---------- */
export default (app: Elysia) =>
  app
    /* ───────── GET /trader/bank-details ───────── */
    .get(
      "",
      async ({ trader, query }) => {
        const todayStart = startOfDay(new Date());
        const todayEnd = endOfDay(new Date());

        const bankDetails = await db.bankDetail.findMany({
          where: { userId: trader.id, isArchived: query.archived === "true" },
          orderBy: { createdAt: "desc" },
        });

        const result = await Promise.all(
          bankDetails.map(async (bd) => {
            /* —— сумма за сегодня —— */
            const {
              _sum: { amount: daySum },
            } = await db.transaction.aggregate({
              where: {
                bankDetailId: bd.id,
                createdAt: { gte: todayStart, lte: todayEnd },
                status: { not: "CANCELED" },
              },
              _sum: { amount: true },
            });

            /* —— сумма за всё время —— */
            const {
              _sum: { amount: totalSum },
            } = await db.transaction.aggregate({
              where: {
                bankDetailId: bd.id,
                status: { not: "CANCELED" },
              },
              _sum: { amount: true },
            });

            return {
              ...bd,
              turnoverDay: daySum ?? 0,
              turnoverTotal: totalSum ?? 0,
              createdAt: bd.createdAt.toISOString(),
              updatedAt: bd.updatedAt.toISOString(),
            };
          }),
        );

        return result;
      },
      {
        tags: ["trader"],
        detail: { summary: "Список реквизитов" },
        query: t.Object({ archived: t.Optional(t.String()) }),
        response: {
          200: t.Array(BankDetailDTO),
          401: ErrorSchema,
          403: ErrorSchema,
        },
      },
    )

    /* ───────── POST /trader/bank-details ───────── */
    .post(
      "",
      async ({ trader, body }) => {
        const rec = await db.bankDetail.create({
          data: {
            ...body,
            dailyLimit: body.dailyLimit ?? 0,
            monthlyLimit: body.monthlyLimit ?? 0,
            userId: trader.id,
            bankType: body.bankType as BankType,
          },
        });
        return toDTO(rec); // userId отброшен
      },
      {
        tags: ["trader"],
        detail: { summary: "Создать реквизит" },
        body: t.Object({
          cardNumber: t.String(),
          bankType: t.String(),
          methodType: t.String(),
          recipientName: t.String(),
          phoneNumber: t.Optional(t.String()),
          minAmount: t.Number(),
          maxAmount: t.Number(),
          dailyLimit: t.Optional(t.Number()),
          monthlyLimit: t.Optional(t.Number()),
          intervalMinutes: t.Number(),
        }),
        response: { 200: BankDetailDTO, 401: ErrorSchema, 403: ErrorSchema },
      },
    )

    /* ───────── PUT /trader/bank-details/:id ───────── */
    .put(
      "/:id",
      async ({ trader, params, body, error }) => {
        const exists = await db.bankDetail.findFirst({
          where: { id: params.id, userId: trader.id },
        });
        if (!exists) return error(404, { error: "Реквизит не найден" });

        const rec = await db.bankDetail.update({
          where: { id: params.id },
          data: {
            ...body,
            dailyLimit: body.dailyLimit ?? 0,
            monthlyLimit: body.monthlyLimit ?? 0,
            bankType: (body.bankType ?? exists.bankType) as BankType,
          },
        });
        return toDTO(rec);
      },
      {
        tags: ["trader"],
        detail: { summary: "Обновить реквизит" },
        params: t.Object({ id: t.String() }),
        body: t.Partial(BankDetailDTO),
        response: {
          200: BankDetailDTO,
          401: ErrorSchema,
          403: ErrorSchema,
          404: ErrorSchema,
        },
      },
    )

    /* ───────── PATCH /trader/bank-details/:id/archive ───────── */
    .patch(
      "/:id/archive",
      async ({ trader, params, body }) => {
        await db.bankDetail.update({
          where: { id: params.id, userId: trader.id },
          data: { isArchived: body.archived },
        });
        return { ok: true };
      },
      {
        tags: ["trader"],
        detail: { summary: "Архивировать / разархивировать" },
        params: t.Object({ id: t.String() }),
        body: t.Object({ archived: t.Boolean() }),
        response: {
          200: t.Object({ ok: t.Boolean() }),
          401: ErrorSchema,
          403: ErrorSchema,
        },
      },
    );
