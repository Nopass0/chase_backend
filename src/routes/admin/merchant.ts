/**
 * routes/admin/merchant.ts
 * ---------------------------------------------------------------------------
 * Админ-маршруты для управления мерчантами + статистика транзакций.
 *
 *   POST   /admin/merchant/create   — создать мерчанта
 *   GET    /admin/merchant/list     — список + totalTx + paidTx
 *   DELETE /admin/merchant/delete   — удалить мерчанта
 * ---------------------------------------------------------------------------
 */

import { Elysia, t } from 'elysia'
import { db } from '@/db'
import { Prisma, Status } from '@prisma/client'
import ErrorSchema from '@/types/error'
import { randomBytes } from 'node:crypto'

/* ─────────── Общие схемы ─────────── */

const AuthHeader = t.Object({ 'x-admin-key': t.String() })

const MerchantBase = t.Object({
  id: t.String(),
  name: t.String(),
  token: t.String({ description: 'Уникальный API-токен' }),
  createdAt: t.String()
})

const MerchantWithCounters = t.Intersect([
  MerchantBase,
  t.Object({
    totalTx: t.Number({ description: 'Всего транзакций' }),
    paidTx:  t.Number({ description: 'Транзакций со статусом READY' })
  })
])

/* ─────────── Утилиты ─────────── */

const toISO = <T extends { createdAt: Date }>(obj: T) =>
  ({ ...obj, createdAt: obj.createdAt.toISOString() } as any)

/* ─────────── Роутер ─────────── */

export default (app: Elysia) =>
  app
    /* ───────── POST /admin/merchant/create ───────── */
    .post(
      '/create',
      async ({ body, error }) => {
        try {
          const m = await db.merchant.create({
            data: { name: body.name, token: randomBytes(32).toString('hex') },
            select: { id: true, name: true, token: true, createdAt: true }
          })
          return new Response(JSON.stringify(toISO(m)), {
            status: 201,
            headers: { 'Content-Type': 'application/json' }
          })
        } catch (e) {
          if (
            e instanceof Prisma.PrismaClientKnownRequestError &&
            e.code === 'P2002'
          )
            return error(409, { error: 'Мерчант с таким именем уже существует' })
          throw e
        }
      },
      {
        tags: ['admin'],
        detail: { summary: 'Создать нового мерчанта' },
        headers: AuthHeader,
        body: t.Object({ name: t.String({ description: 'Название мерчанта' }) }),
        response: { 201: MerchantBase, 409: ErrorSchema }
      }
    )

    /* ───────── GET /admin/merchant/list ───────── */
    .get(
      '/list',
      async () => {
        /* 1. Получаем мерчантов */
        const merchants = await db.merchant.findMany({
          select: { id: true, name: true, token: true, createdAt: true }
        })

        if (!merchants.length) return []

        const ids = merchants.map((m) => m.id)

        /* 2. Агрегируем транзакции одним groupBy */
        const grouped = await db.transaction.groupBy({
          by: ['merchantId'],
          _count: { _all: true },
          where: { merchantId: { in: ids } }
        })

        const groupedPaid = await db.transaction.groupBy({
          by: ['merchantId'],
          _count: { _all: true },
          where: {
            merchantId: { in: ids },
            status: Status.READY
          }
        })

        /* 3. Быстрый lookup по merchantId → counts */
        const totalMap = Object.fromEntries(
          grouped.map((g) => [g.merchantId, g._count._all])
        )
        const paidMap = Object.fromEntries(
          groupedPaid.map((g) => [g.merchantId, g._count._all])
        )

        /* 4. Формируем ответ */
        return merchants.map((m) =>
          ({
            ...toISO(m),
            totalTx: totalMap[m.id] ?? 0,
            paidTx:  paidMap[m.id]  ?? 0
          }) as typeof MerchantWithCounters.static
        )
      },
      {
        tags: ['admin'],
        detail: { summary: 'Список мерчантов + статистика транзакций' },
        headers: AuthHeader,
        response: { 200: t.Array(MerchantWithCounters) }
      }
    )

    /* ───────── DELETE /admin/merchant/delete ───────── */
    .delete(
      '/delete',
      async ({ body, error }) => {
        try {
          await db.merchant.delete({ where: { id: body.id } })
          return { ok: true }
        } catch (e) {
          if (
            e instanceof Prisma.PrismaClientKnownRequestError &&
            e.code === 'P2025'
          )
            return error(404, { error: 'Мерчант не найден' })
          throw e
        }
      },
      {
        tags: ['admin'],
        detail: { summary: 'Удалить мерчанта' },
        headers: AuthHeader,
        body: t.Object({ id: t.String() }),
        response: {
          200: t.Object({ ok: t.Boolean() }),
          404: ErrorSchema
        }
      }
    )
