/**
 * admin/transactions.ts
 * ---------------------------------------------------------------------------
 * Полный набор административных маршрутов для управления транзакциями.
 *
 * ▸ Elysia + Prisma + TypeBox (t)
 * ▸ Все даты сериализуются в ISO-формат, поэтому схемы t.String() валидны.
 * ▸ В ответах не возвращаем `rate: null` (заменяем на undefined).
 * ▸ Добавлено частичное редактирование (PATCH /:id).
 * ▸ Каждый маршрут снабжён полной документацией — headers, params/query/body,
 *   описания, схемы ответов и ошибок.
 * ---------------------------------------------------------------------------
 */

import { Elysia, t } from 'elysia'
import { db } from '@/db'
import {
  Prisma,
  Status,
  TransactionType,
  MethodType,
  Currency
} from '@prisma/client'
import ErrorSchema from '@/types/error'

/* ───────────────────── helpers ───────────────────── */

/** Унифицированная сериализация транзакции и связанных сущностей */
const serializeTransaction = (trx: any) => ({
  ...trx,
  expired_at: trx.expired_at.toISOString(),
  createdAt: trx.createdAt.toISOString(),
  updatedAt: trx.updatedAt.toISOString(),
  merchant: {
    ...trx.merchant,
    createdAt: trx.merchant.createdAt.toISOString()
  },
  trader: trx.trader
    ? { ...trx.trader, createdAt: trx.trader.createdAt.toISOString() }
    : null,
  ...(trx.rate === null ? { rate: undefined } : {})
})

/** Обновление + include + сериализация (чтобы не дублировать код) */
const updateTrx = async (
  id: string,
  data: Prisma.TransactionUpdateInput
) =>
  serializeTransaction(
    await db.transaction.update({
      where: { id },
      data,
      include: { merchant: true, method: true, trader: true }
    })
  )

/* ───────────────────── reusable schemas ───────────────────── */

const TransactionResponseSchema = t.Object({
  id: t.String(),
  merchantId: t.String(),
  amount: t.Number(),
  assetOrBank: t.String(),
  orderId: t.String(),
  methodId: t.String(),
  currency: t.Optional(t.String()),
  userId: t.String(),
  userIp: t.Optional(t.String()),
  callbackUri: t.String(),
  successUri: t.String(),
  failUri: t.String(),
  type: t.Enum(TransactionType),
  expired_at: t.String(),
  commission: t.Number(),
  clientName: t.String(),
  status: t.Enum(Status),
  rate: t.Optional(t.Number()),
  isMock: t.Boolean(),
  createdAt: t.String(),
  updatedAt: t.String(),
  merchant: t.Object({
    id: t.String(),
    name: t.String(),
    token: t.String(),
    createdAt: t.String()
  }),
  method: t.Object({
    id: t.String(),
    code: t.String(),
    name: t.String(),
    type: t.Enum(MethodType),
    currency: t.Enum(Currency)
  }),
  trader: t.Object({
    id: t.String(),
    email: t.String(),
    banned: t.Boolean(),
    createdAt: t.String()
  })
})

const AuthHeaderSchema = t.Object({ 'x-admin-key': t.String() })

/* ───────────────────── router ───────────────────── */

export default (app: Elysia) =>
  app
    /* ─────────── POST /admin/transactions/create ─────────── */
    .post(
      '/create',
      async ({ body, error }) => {
        try {
          /* Проверка FK */
          const [merchant, method, user] = await Promise.all([
            db.merchant.findUnique({ where: { id: body.merchantId } }),
            db.method.findUnique({ where: { id: body.methodId } }),
            db.user.findUnique({ where: { id: body.userId } })
          ])
          if (!merchant) return error(404, { error: 'Мерчант не найден' })
          if (!method) return error(404, { error: 'Метод не найден' })
          if (!user) return error(404, { error: 'Пользователь не найден' })

          const trx = await db.transaction.create({
            data: {
              ...body,
              expired_at:
                body.expired_at ??
                new Date(Date.now() + 24 * 60 * 60 * 1000),
              isMock: true
            },
            include: { merchant: true, method: true, trader: true }
          })

          return new Response(
            JSON.stringify(serializeTransaction(trx)),
            { status: 201, headers: { 'Content-Type': 'application/json' } }
          )
        } catch (e) {
          if (
            e instanceof Prisma.PrismaClientKnownRequestError &&
            e.code === 'P2002'
          )
            return error(409, { error: 'orderId уже используется' })
          throw e
        }
      },
      {
        tags: ['admin'],
        detail: { summary: 'Создание новой транзакции (моковая)' },
        headers: AuthHeaderSchema,
        body: t.Object({
          merchantId: t.String({ description: 'ID мерчанта' }),
          amount: t.Number({ description: 'Сумма' }),
          assetOrBank: t.String({ description: 'Актив/банк' }),
          orderId: t.String({ description: 'Уникальный orderId' }),
          methodId: t.String({ description: 'ID метода' }),
          currency: t.Optional(t.String()),
          userId: t.String({ description: 'ID пользователя' }),
          userIp: t.Optional(t.String()),
          callbackUri: t.String(),
          successUri: t.String(),
          failUri: t.String(),
          type: t.Optional(t.Enum(TransactionType)),
          expired_at: t.Optional(t.String()),
          commission: t.Number(),
          clientName: t.String(),
          status: t.Optional(t.Enum(Status)),
          rate: t.Optional(t.Number())
        }),
        response: {
          201: TransactionResponseSchema,
          404: ErrorSchema,
          409: ErrorSchema
        }
      }
    )

/* ──────────── GET /admin/transactions/list ──────────── */
.get(
  '/list',
  async ({ query }) => {
    const where: Prisma.TransactionWhereInput = {};

    /* ------- фильтры из query-строки ------- */
    if (query.status)      where.status     = query.status as Status;
    if (query.type)        where.type       = query.type as TransactionType;
    if (query.merchantId)  where.merchantId = query.merchantId;
    if (query.methodId)    where.methodId   = query.methodId;
    if (query.userId)      where.userId     = query.userId;
    if (query.isMock !== undefined)
      where.isMock = query.isMock === 'true';

    if (query.createdFrom)
      where.createdAt = { ...where.createdAt, gte: new Date(query.createdFrom) };
    if (query.createdTo)
      where.createdAt = { ...where.createdAt, lte: new Date(query.createdTo) };

    if (query.search) {
      const s = query.search;
      where.OR = [
        { id          : { contains: s, mode: 'insensitive' } },
        { orderId     : { contains: s, mode: 'insensitive' } },
        { assetOrBank : { contains: s, mode: 'insensitive' } },
        { clientName  : { contains: s, mode: 'insensitive' } },
        { currency    : { contains: s, mode: 'insensitive' } },
        { userIp      : { contains: s, mode: 'insensitive' } },
      ];
    }

    const orderBy: Record<string, 'asc' | 'desc'> = {};
    if (query.sortBy)
      orderBy[query.sortBy] = query.sortOrder === 'desc' ? 'desc' : 'asc';
    else orderBy.updatedAt = 'desc';

    const page  = Number(query.page)  || 1;
    const limit = Number(query.limit) || 20;
    const skip  = (page - 1) * limit;

    const [rows, total] = await Promise.all([
      db.transaction.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          merchant : true,
          method   : true,
          trader   : { select: { id: true, name: true, email: true } }, // ← НОВОЕ
        },
      }),
      db.transaction.count({ where }),
    ]);

    /* сериализация дат → ISO */
    const data = rows.map(t => ({
      ...t,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    }));

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  },
  {
    tags: ['admin'],
    detail : { summary: 'Список транзакций (фильтры, сортировка, пагинация)' },
    headers: AuthHeaderSchema,
    query  : t.Object({
      page: t.Optional(t.String()),
      limit: t.Optional(t.String()),
      status: t.Optional(t.String()),
      type: t.Optional(t.String()),
      merchantId: t.Optional(t.String()),
      methodId  : t.Optional(t.String()),
      userId    : t.Optional(t.String()),
      isMock    : t.Optional(t.String()),
      createdFrom: t.Optional(t.String()),
      createdTo  : t.Optional(t.String()),
      search   : t.Optional(t.String()),
      sortBy   : t.Optional(t.String()),
      sortOrder: t.Optional(t.String()),
    }),
  },
)


    /* ─────────── GET /admin/transactions/:id ─────────── */
    .get(
      '/:id',
      async ({ params, error }) => {
        try {
          const trx = await db.transaction.findUniqueOrThrow({
            where: { id: params.id },
            include: { merchant: true, method: true, trader: true }
          })
          return serializeTransaction(trx)
        } catch (e) {
          if (
            e instanceof Prisma.PrismaClientKnownRequestError &&
            e.code === 'P2025'
          )
            return error(404, { error: 'Транзакция не найдена' })
          throw e
        }
      },
      {
        tags: ['admin'],
        detail: { summary: 'Получить транзакцию по ID' },
        headers: AuthHeaderSchema,
        params: t.Object({ id: t.String() }),
        response: { 200: TransactionResponseSchema, 404: ErrorSchema }
      }
    )

    /* ─────────── PATCH /admin/transactions/:id ─────────── */
    .patch(
      '/:id',
      async ({ params, body, error }) => {
        try {
          return await updateTrx(params.id, {
            ...body,
            expired_at: body.expired_at
              ? new Date(body.expired_at)
              : undefined,
            isMock: true
          })
        } catch (e) {
          if (
            e instanceof Prisma.PrismaClientKnownRequestError &&
            e.code === 'P2025'
          )
            return error(404, { error: 'Транзакция не найдена' })
          if (
            e instanceof Prisma.PrismaClientKnownRequestError &&
            e.code === 'P2002'
          )
            return error(409, { error: 'orderId уже используется' })
          throw e
        }
      },
      {
        tags: ['admin'],
        detail: { summary: 'Частичное редактирование транзакции' },
        headers: AuthHeaderSchema,
        params: t.Object({ id: t.String() }),
        body: t.Partial(
          t.Object({
            amount: t.Number(),
            assetOrBank: t.String(),
            orderId: t.String(),
            methodId: t.String(),
            merchantId: t.String(),
            currency: t.Optional(t.String()),
            userId: t.String(),
            userIp: t.Optional(t.String()),
            callbackUri: t.String(),
            successUri: t.String(),
            failUri: t.String(),
            type: t.Enum(TransactionType),
            expired_at: t.Optional(t.String()),
            commission: t.Number(),
            clientName: t.String(),
            status: t.Enum(Status),
            rate: t.Optional(t.Number())
          })
        ),
        response: { 200: TransactionResponseSchema, 404: ErrorSchema, 409: ErrorSchema }
      }
    )

    /* ─────────── PUT /admin/transactions/update ─────────── */
    .put(
      '/update',
      async ({ body, error }) =>
        updateTrx(body.id, {
          ...body,
          expired_at: body.expired_at ? new Date(body.expired_at) : undefined,
          isMock: true
        }).catch((e) => {
          if (
            e instanceof Prisma.PrismaClientKnownRequestError &&
            e.code === 'P2025'
          )
            return error(404, { error: 'Транзакция не найдена' })
          if (
            e instanceof Prisma.PrismaClientKnownRequestError &&
            e.code === 'P2002'
          )
            return error(409, { error: 'orderId уже используется' })
          if (
            e instanceof Prisma.PrismaClientKnownRequestError &&
            e.code === 'P2003'
          )
            return error(400, {
              error: 'Указанный мерчант, метод или пользователь не существует'
            })
          throw e
        }),
      {
        tags: ['admin'],
        detail: { summary: 'Полное обновление транзакции' },
        headers: AuthHeaderSchema,
        body: t.Object({
          id: t.String(),
          merchantId: t.String(),
          amount: t.Number(),
          assetOrBank: t.String(),
          orderId: t.String(),
          methodId: t.String(),
          currency: t.Optional(t.String()),
          userId: t.String(),
          userIp: t.Optional(t.String()),
          callbackUri: t.String(),
          successUri: t.String(),
          failUri: t.String(),
          type: t.Enum(TransactionType),
          expired_at: t.Optional(t.String()),
          commission: t.Number(),
          clientName: t.String(),
          status: t.Enum(Status),
          rate: t.Optional(t.Number())
        }),
        response: {
          200: TransactionResponseSchema,
          404: ErrorSchema,
          409: ErrorSchema,
          400: ErrorSchema
        }
      }
    )

    /* ─────────── PUT /admin/transactions/status ─────────── */
    .put(
      '/status',
      async ({ body, error }) => {
        try {
          return await updateTrx(body.id, { status: body.status })
        } catch (e) {
          if (
            e instanceof Prisma.PrismaClientKnownRequestError &&
            e.code === 'P2025'
          )
            return error(404, { error: 'Транзакция не найдена' })
          throw e
        }
      },
      {
        tags: ['admin'],
        detail: { summary: 'Сменить статус транзакции' },
        headers: AuthHeaderSchema,
        body: t.Object({
          id: t.String(),
          status: t.Enum(Status)
        }),
        response: { 200: TransactionResponseSchema, 404: ErrorSchema }
      }
    )

    /* ─────────── DELETE /admin/transactions/delete ─────────── */
    .delete(
      '/delete',
      async ({ body, error }) => {
        try {
          await db.transaction.delete({ where: { id: body.id } })
          return { ok: true }
        } catch (e) {
          if (
            e instanceof Prisma.PrismaClientKnownRequestError &&
            e.code === 'P2025'
          )
            return error(404, { error: 'Транзакция не найдена' })
          throw e
        }
      },
      {
        tags: ['admin'],
        detail: { summary: 'Удаление транзакции' },
        headers: AuthHeaderSchema,
        body: t.Object({ id: t.String() }),
        response: {
          200: t.Object({ ok: t.Boolean() }),
          404: ErrorSchema
        }
      }
    )
