import { Elysia, t } from "elysia";
import { db } from "@/db";
import { Prisma, Status, TransactionType } from "@prisma/client";
import ErrorSchema from "@/types/error";
import { traderGuard } from "@/middleware/traderGuard";

/**
 * Маршруты для управления транзакциями трейдера
 */
export default (app: Elysia) =>
  app
    .use(traderGuard())

    /* ───────── GET /trader/transactions - получение списка транзакций трейдера ───────── */
    .get(
      "",
      async ({ trader, query }) => {
        // Параметры фильтрации и пагинации
        const page = Number(query.page) || 1;
        const limit = Number(query.limit) || 10;
        const skip = (page - 1) * limit;

        const traderInstance = await db.user.findUnique({
          where: { id: trader.id },
        });

        // Формируем условия фильтрации
        const where: Prisma.TransactionWhereInput = {
          trader: traderInstance,
        };

        // Фильтрация по статусу, если указан
        if (query.status) {
          where.status = query.status as Status;
        }

        // Фильтрация по типу транзакции, если указан
        if (query.type) {
          where.type = query.type as TransactionType;
        }

        // Получаем транзакции с пагинацией
        const transactions = await db.transaction.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
          include: {
            merchant: {
              select: {
                id: true,
                name: true,
              },
            },
            method: {
              select: {
                id: true,
                name: true,
                type: true,
              },
            },
            receipts: {
              select: {
                id: true,
                fileName: true,
                isChecked: true,
                isFake: true,
              },
            },
          },
        });

        // Получаем общее количество транзакций для пагинации
        const total = await db.transaction.count({ where });

        // Преобразуем даты в ISO формат
        const formattedTransactions = transactions.map((tx) => ({
          ...tx,
          createdAt: tx.createdAt.toISOString(),
          updatedAt: tx.updatedAt.toISOString(),
          expired_at: tx.expired_at.toISOString(),
        }));

        return {
          data: formattedTransactions,
          pagination: {
            total,
            page,
            limit,
            pages: Math.ceil(total / limit),
          },
        };
      },
      {
        tags: ["trader"],
        detail: { summary: "Получение списка транзакций трейдера" },
        query: t.Object({
          page: t.Optional(t.String()),
          limit: t.Optional(t.String()),
          status: t.Optional(t.String()),
          type: t.Optional(t.String()),
        }),
        response: {
          200: t.Object({
            data: t.Array(
              t.Object({
                id: t.String(),
                numericId: t.Number(),
                merchantId: t.String(),
                amount: t.Number(),
                assetOrBank: t.String(),
                orderId: t.String(),
                methodId: t.String(),
                currency: t.Union([t.String(), t.Null()]),
                userId: t.String(),
                userIp: t.Union([t.String(), t.Null()]),
                callbackUri: t.String(),
                successUri: t.String(),
                failUri: t.String(),
                type: t.String(),
                expired_at: t.String(),
                commission: t.Number(),
                clientName: t.String(),
                status: t.String(),
                rate: t.Union([t.Number(), t.Null()]),
                traderId: t.Union([t.String(), t.Null()]),
                isMock: t.Boolean(),
                createdAt: t.String(),
                updatedAt: t.String(),
                merchant: t.Object({
                  id: t.String(),
                  name: t.String(),
                }),
                method: t.Object({
                  id: t.String(),
                  name: t.String(),
                  type: t.String(),
                }),
                receipts: t.Array(
                  t.Object({
                    id: t.String(),
                    fileName: t.String(),
                    isChecked: t.Boolean(),
                    isFake: t.Boolean(),
                  }),
                ),
              }),
            ),
            pagination: t.Object({
              total: t.Number(),
              page: t.Number(),
              limit: t.Number(),
              pages: t.Number(),
            }),
          }),
          401: ErrorSchema,
          403: ErrorSchema,
        },
      },
    )

    /* ───────── GET /trader/transactions/:id - получение детальной информации о транзакции ───────── */
    .get(
      "/:id",
      async ({ trader, params, error }) => {
        const transaction = await db.transaction.findUnique({
          where: {
            id: params.id,
            traderId: trader.id,
          },
          include: {
            merchant: true,
            method: true,
            receipts: true,
          },
        });

        if (!transaction) {
          return error(404, { error: "Транзакция не найдена" });
        }

        // Преобразуем даты в ISO формат
        return {
          ...transaction,
          createdAt: transaction.createdAt.toISOString(),
          updatedAt: transaction.updatedAt.toISOString(),
          expired_at: transaction.expired_at.toISOString(),
          merchant: {
            ...transaction.merchant,
            createdAt: transaction.merchant.createdAt.toISOString(),
          },
        };
      },
      {
        tags: ["trader"],
        detail: { summary: "Получение детальной информации о транзакции" },
        params: t.Object({
          id: t.String({
            description: "ID транзакции",
          }),
        }),
        response: {
          200: t.Object({
            id: t.String(),
            numericId: t.Number(),
            merchantId: t.String(),
            amount: t.Number(),
            assetOrBank: t.String(),
            orderId: t.String(),
            methodId: t.String(),
            currency: t.Union([t.String(), t.Null()]),
            userId: t.String(),
            userIp: t.Union([t.String(), t.Null()]),
            callbackUri: t.String(),
            successUri: t.String(),
            failUri: t.String(),
            type: t.String(),
            expired_at: t.String(),
            commission: t.Number(),
            clientName: t.String(),
            status: t.String(),
            rate: t.Union([t.Number(), t.Null()]),
            traderId: t.Union([t.String(), t.Null()]),
            isMock: t.Boolean(),
            createdAt: t.String(),
            updatedAt: t.String(),
            merchant: t.Object({
              id: t.String(),
              name: t.String(),
              token: t.String(),
              disabled: t.Boolean(),
              banned: t.Boolean(),
              createdAt: t.String(),
            }),
            method: t.Object({
              id: t.String(),
              code: t.String(),
              name: t.String(),
              type: t.String(),
              currency: t.String(),
              commissionPayin: t.Number(),
              commissionPayout: t.Number(),
              maxPayin: t.Number(),
              minPayin: t.Number(),
              maxPayout: t.Number(),
              minPayout: t.Number(),
              chancePayin: t.Number(),
              chancePayout: t.Number(),
              isEnabled: t.Boolean(),
              rateSource: t.String(),
            }),
            receipts: t.Array(
              t.Object({
                id: t.String(),
                transactionId: t.String(),
                fileData: t.String(),
                fileName: t.String(),
                isChecked: t.Boolean(),
                isFake: t.Boolean(),
                isAuto: t.Boolean(),
                createdAt: t.String(),
                updatedAt: t.String(),
              }),
            ),
          }),
          401: ErrorSchema,
          403: ErrorSchema,
          404: ErrorSchema,
        },
      },
    )

    /* ───────── PATCH /trader/transactions/:id/status - обновление статуса транзакции ───────── */
    .patch(
      "/:id/status",
      async ({ trader, params, body, error }) => {
        // Проверяем, существует ли транзакция и принадлежит ли она трейдеру
        const transaction = await db.transaction.findFirst({
          where: {
            id: params.id,
            traderId: trader.id,
          },
        });

        if (!transaction) {
          return error(404, { error: "Транзакция не найдена" });
        }

        // Проверяем, можно ли обновить статус транзакции
        if (
          transaction.status === Status.EXPIRED ||
          transaction.status === Status.CANCELED
        ) {
          return error(400, {
            error: "Невозможно обновить статус завершенной транзакции",
          });
        }

        // Обновляем статус транзакции
        const updatedTransaction = await db.transaction.update({
          where: { id: params.id },
          data: { status: body.status },
        });

        return {
          success: true,
          transaction: {
            ...updatedTransaction,
            createdAt: updatedTransaction.createdAt.toISOString(),
            updatedAt: updatedTransaction.updatedAt.toISOString(),
            expired_at: updatedTransaction.expired_at.toISOString(),
          },
        };
      },
      {
        tags: ["trader"],
        detail: { summary: "Обновление статуса транзакции" },
        params: t.Object({
          id: t.String({
            description: "ID транзакции",
          }),
        }),
        body: t.Object({
          status: t.Enum(Status, {
            description: "Новый статус транзакции",
          }),
        }),
        response: {
          200: t.Object({
            success: t.Boolean(),
            transaction: t.Object({
              id: t.String(),
              numericId: t.Number(),
              merchantId: t.String(),
              amount: t.Number(),
              assetOrBank: t.String(),
              orderId: t.String(),
              methodId: t.String(),
              currency: t.Union([t.String(), t.Null()]),
              userId: t.String(),
              userIp: t.Union([t.String(), t.Null()]),
              callbackUri: t.String(),
              successUri: t.String(),
              failUri: t.String(),
              type: t.String(),
              expired_at: t.String(),
              commission: t.Number(),
              clientName: t.String(),
              status: t.String(),
              rate: t.Union([t.Number(), t.Null()]),
              traderId: t.Union([t.String(), t.Null()]),
              isMock: t.Boolean(),
              createdAt: t.String(),
              updatedAt: t.String(),
            }),
          }),
          400: ErrorSchema,
          401: ErrorSchema,
          403: ErrorSchema,
          404: ErrorSchema,
        },
      },
    );
