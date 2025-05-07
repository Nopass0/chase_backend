import { Elysia, t } from "elysia";
import { db } from "@/db";
import { BankType, MethodType } from "@prisma/client";
import ErrorSchema from "@/types/error";
import { traderGuard } from "@/middleware/traderGuard";

/**
 * Маршруты для управления криптокошельками и банковскими реквизитами трейдера
 */
export default (app: Elysia) =>
  app
    .use(traderGuard())
    
    /* ───────── GET /trader/wallet/crypto - получение криптокошелька трейдера ───────── */
    .get(
      "/crypto",
      async ({ trader }) => {
        const wallet = await db.cryptoWallet.findUnique({
          where: { userId: trader.id },
        });
        
        if (!wallet) {
          return { wallet: null };
        }
        
        return {
          wallet: {
            id: wallet.id,
            address: wallet.address,
            isActive: wallet.isActive,
            createdAt: wallet.createdAt.toISOString(),
            updatedAt: wallet.updatedAt.toISOString(),
          }
        };
      },
      {
        tags: ["trader"],
        detail: { summary: "Получение криптокошелька трейдера" },
        response: {
          200: t.Object({
            wallet: t.Union([
              t.Object({
                id: t.String(),
                address: t.String(),
                isActive: t.Boolean(),
                createdAt: t.String(),
                updatedAt: t.String(),
              }),
              t.Null(),
            ]),
          }),
          401: ErrorSchema,
          403: ErrorSchema,
        },
      }
    )
    
    /* ───────── POST /trader/wallet/crypto - создание/обновление криптокошелька трейдера ───────── */
    .post(
      "/crypto",
      async ({ trader, body }) => {
        const existingWallet = await db.cryptoWallet.findUnique({
          where: { userId: trader.id },
        });
        
        let wallet;
        
        if (existingWallet) {
          // Обновляем существующий кошелек
          wallet = await db.cryptoWallet.update({
            where: { id: existingWallet.id },
            data: {
              address: body.address,
              isActive: body.isActive ?? true,
            },
          });
        } else {
          // Создаем новый кошелек
          wallet = await db.cryptoWallet.create({
            data: {
              address: body.address,
              isActive: body.isActive ?? true,
              userId: trader.id,
            },
          });
        }
        
        return {
          wallet: {
            id: wallet.id,
            address: wallet.address,
            isActive: wallet.isActive,
            createdAt: wallet.createdAt.toISOString(),
            updatedAt: wallet.updatedAt.toISOString(),
          }
        };
      },
      {
        tags: ["trader"],
        detail: { summary: "Создание или обновление криптокошелька трейдера" },
        body: t.Object({
          address: t.String({
            description: "Адрес криптокошелька",
          }),
          isActive: t.Optional(t.Boolean({
            description: "Активен ли кошелек",
            default: true,
          })),
        }),
        response: {
          200: t.Object({
            wallet: t.Object({
              id: t.String(),
              address: t.String(),
              isActive: t.Boolean(),
              createdAt: t.String(),
              updatedAt: t.String(),
            }),
          }),
          401: ErrorSchema,
          403: ErrorSchema,
        },
      }
    )
    
    /* ───────── GET /trader/wallet/bank-details - получение банковских реквизитов трейдера ───────── */
    .get(
      "/bank-details",
      async ({ trader }) => {
        const bankDetails = await db.bankDetail.findMany({
          where: { userId: trader.id },
        });
        
        return {
          bankDetails: bankDetails.map(detail => ({
            id: detail.id,
            methodType: detail.methodType,
            bankType: detail.bankType,
            cardNumber: detail.cardNumber,
            holderName: detail.holderName,
            isActive: detail.isActive,
            createdAt: detail.createdAt.toISOString(),
            updatedAt: detail.updatedAt.toISOString(),
          })),
        };
      },
      {
        tags: ["trader"],
        detail: { summary: "Получение банковских реквизитов трейдера" },
        response: {
          200: t.Object({
            bankDetails: t.Array(
              t.Object({
                id: t.String(),
                methodType: t.Enum(MethodType),
                bankType: t.Enum(BankType),
                cardNumber: t.String(),
                holderName: t.String(),
                isActive: t.Boolean(),
                createdAt: t.String(),
                updatedAt: t.String(),
              })
            ),
          }),
          401: ErrorSchema,
          403: ErrorSchema,
        },
      }
    )
    
    /* ───────── POST /trader/wallet/bank-details - создание банковских реквизитов трейдера ───────── */
    .post(
      "/bank-details",
      async ({ trader, body }) => {
        const bankDetail = await db.bankDetail.create({
          data: {
            userId: trader.id,
            methodType: body.methodType,
            bankType: body.bankType,
            cardNumber: body.cardNumber,
            holderName: body.holderName,
            isActive: body.isActive ?? true,
          },
        });
        
        return {
          bankDetail: {
            id: bankDetail.id,
            methodType: bankDetail.methodType,
            bankType: bankDetail.bankType,
            cardNumber: bankDetail.cardNumber,
            holderName: bankDetail.holderName,
            isActive: bankDetail.isActive,
            createdAt: bankDetail.createdAt.toISOString(),
            updatedAt: bankDetail.updatedAt.toISOString(),
          }
        };
      },
      {
        tags: ["trader"],
        detail: { summary: "Создание банковских реквизитов трейдера" },
        body: t.Object({
          methodType: t.Enum(MethodType, {
            description: "Тип метода оплаты",
          }),
          bankType: t.Enum(BankType, {
            description: "Тип банка",
          }),
          cardNumber: t.String({
            description: "Номер карты или счета",
          }),
          holderName: t.String({
            description: "Имя владельца карты или счета",
          }),
          isActive: t.Optional(t.Boolean({
            description: "Активны ли реквизиты",
            default: true,
          })),
        }),
        response: {
          200: t.Object({
            bankDetail: t.Object({
              id: t.String(),
              methodType: t.Enum(MethodType),
              bankType: t.Enum(BankType),
              cardNumber: t.String(),
              holderName: t.String(),
              isActive: t.Boolean(),
              createdAt: t.String(),
              updatedAt: t.String(),
            }),
          }),
          401: ErrorSchema,
          403: ErrorSchema,
        },
      }
    )
    
    /* ───────── PATCH /trader/wallet/bank-details/:id - обновление банковских реквизитов трейдера ───────── */
    .patch(
      "/bank-details/:id",
      async ({ trader, params, body, error }) => {
        // Проверяем, существуют ли реквизиты и принадлежат ли они трейдеру
        const existingDetail = await db.bankDetail.findFirst({
          where: {
            id: params.id,
            userId: trader.id,
          },
        });
        
        if (!existingDetail) {
          return error(404, { error: "Банковские реквизиты не найдены" });
        }
        
        const updatedDetail = await db.bankDetail.update({
          where: { id: params.id },
          data: {
            methodType: body.methodType ?? existingDetail.methodType,
            bankType: body.bankType ?? existingDetail.bankType,
            cardNumber: body.cardNumber ?? existingDetail.cardNumber,
            holderName: body.holderName ?? existingDetail.holderName,
            isActive: body.isActive ?? existingDetail.isActive,
          },
        });
        
        return {
          bankDetail: {
            id: updatedDetail.id,
            methodType: updatedDetail.methodType,
            bankType: updatedDetail.bankType,
            cardNumber: updatedDetail.cardNumber,
            holderName: updatedDetail.holderName,
            isActive: updatedDetail.isActive,
            createdAt: updatedDetail.createdAt.toISOString(),
            updatedAt: updatedDetail.updatedAt.toISOString(),
          }
        };
      },
      {
        tags: ["trader"],
        detail: { summary: "Обновление банковских реквизитов трейдера" },
        params: t.Object({
          id: t.String({
            description: "ID банковских реквизитов",
          }),
        }),
        body: t.Object({
          methodType: t.Optional(t.Enum(MethodType, {
            description: "Тип метода оплаты",
          })),
          bankType: t.Optional(t.Enum(BankType, {
            description: "Тип банка",
          })),
          cardNumber: t.Optional(t.String({
            description: "Номер карты или счета",
          })),
          holderName: t.Optional(t.String({
            description: "Имя владельца карты или счета",
          })),
          isActive: t.Optional(t.Boolean({
            description: "Активны ли реквизиты",
          })),
        }),
        response: {
          200: t.Object({
            bankDetail: t.Object({
              id: t.String(),
              methodType: t.Enum(MethodType),
              bankType: t.Enum(BankType),
              cardNumber: t.String(),
              holderName: t.String(),
              isActive: t.Boolean(),
              createdAt: t.String(),
              updatedAt: t.String(),
            }),
          }),
          401: ErrorSchema,
          403: ErrorSchema,
          404: ErrorSchema,
        },
      }
    )
    
    /* ───────── DELETE /trader/wallet/bank-details/:id - удаление банковских реквизитов трейдера ───────── */
    .delete(
      "/bank-details/:id",
      async ({ trader, params, error }) => {
        // Проверяем, существуют ли реквизиты и принадлежат ли они трейдеру
        const existingDetail = await db.bankDetail.findFirst({
          where: {
            id: params.id,
            userId: trader.id,
          },
        });
        
        if (!existingDetail) {
          return error(404, { error: "Банковские реквизиты не найдены" });
        }
        
        await db.bankDetail.delete({
          where: { id: params.id },
        });
        
        return { success: true };
      },
      {
        tags: ["trader"],
        detail: { summary: "Удаление банковских реквизитов трейдера" },
        params: t.Object({
          id: t.String({
            description: "ID банковских реквизитов",
          }),
        }),
        response: {
          200: t.Object({
            success: t.Boolean(),
          }),
          401: ErrorSchema,
          403: ErrorSchema,
          404: ErrorSchema,
        },
      }
    );