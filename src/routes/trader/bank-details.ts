// src/server/routes/trader/bank-details.ts
import { Elysia, t } from "elysia";
import { db } from "@/db";
import { BankType } from "@prisma/client";
import ErrorSchema from "@/types/error";
import { startOfDay, endOfDay } from "date-fns";

/* ---------- DTOs ---------- */
const DeviceDTO = t.Object({
  id: t.String(),
  name: t.String(),
  energy: t.Union([t.Number(), t.Null()]),
  ethernetSpeed: t.Union([t.Number(), t.Null()]),
  isOnline: t.Optional(t.Boolean()),
  token: t.String(),
  createdAt: t.String(),
  updatedAt: t.String(),
});

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
  hasDevice: t.Boolean(), // Flag indicating if this bank detail has a device
  device: DeviceDTO, // Connected device (empty object if no device)
  createdAt: t.String(),
  updatedAt: t.String(),
});

/* ---------- helpers ---------- */
const formatDevice = (device) => {
  if (!device) {
    // Return empty device object instead of null to satisfy schema requirements
    return {
      id: "",
      name: "",
      energy: 0,
      ethernetSpeed: 0,
      isOnline: false,
      token: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }
  
  return {
    id: device.id,
    name: device.name,
    energy: device.energy, // Can be null
    ethernetSpeed: device.ethernetSpeed, // Can be null
    isOnline: device.isOnline,
    token: device.token || '',
    createdAt: device.createdAt.toISOString(),
    updatedAt: device.updatedAt.toISOString(),
  };
};

const toDTO = (
  bankDetail,
  turnoverDay = 0,
  turnoverTotal = 0,
  device = null,
) => {
  const { userId, Device, ...rest } = bankDetail;
  
  // Try to get device from the Device property if it exists and no device was provided
  const deviceToUse = device || (Device && Device.length > 0 ? Device[0] : null);
  
  return {
    ...rest,
    turnoverDay,
    turnoverTotal,
    hasDevice: !!deviceToUse,
    device: formatDevice(deviceToUse),
    createdAt: bankDetail.createdAt.toISOString(),
    updatedAt: bankDetail.updatedAt.toISOString(),
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

        // Get bank details with their devices
        const bankDetails = await db.bankDetail.findMany({
          where: { 
            userId: trader.id, 
            isArchived: query.archived === "true" 
          },
          include: {
            Device: {
              take: 1 // Get only the first device if there are many
            }
          },
          orderBy: { createdAt: "desc" },
        });

        const result = await Promise.all(
          bankDetails.map(async (bd) => {
            /* —— daily turnover —— */
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

            /* —— total turnover —— */
            const {
              _sum: { amount: totalSum },
            } = await db.transaction.aggregate({
              where: {
                bankDetailId: bd.id,
                status: { not: "CANCELED" },
              },
              _sum: { amount: true },
            });

            return toDTO(bd, daySum ?? 0, totalSum ?? 0);
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
        const bankDetail = await db.bankDetail.create({
          data: {
            ...body,
            dailyLimit: body.dailyLimit ?? 0,
            monthlyLimit: body.monthlyLimit ?? 0,
            userId: trader.id,
            bankType: body.bankType as BankType,
          },
        });
        
        // Bank detail was just created, so there are no devices yet
        return toDTO(bankDetail, 0, 0);
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

        const bankDetail = await db.bankDetail.update({
          where: { id: params.id },
          data: {
            ...body,
            dailyLimit: body.dailyLimit ?? 0,
            monthlyLimit: body.monthlyLimit ?? 0,
            bankType: (body.bankType ?? exists.bankType) as BankType,
          },
          include: {
            Device: {
              take: 1
            }
          }
        });
        
        return toDTO(bankDetail, 0, 0);
      },
      {
        tags: ["trader"],
        detail: { summary: "Обновить реквизит" },
        params: t.Object({ id: t.String() }),
        body: t.Partial(
          t.Object({
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
          })
        ),
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