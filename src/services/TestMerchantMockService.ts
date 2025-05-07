// src/services/TestMerchantMockService.ts
import { BaseService } from "./BaseService";
import { db } from "@/db";
import {
  Currency,
  Method,
  Prisma,
  Status,
  TransactionType,
} from "@prisma/client";
import { randomBytes } from "node:crypto";

/**
 * TestMerchantMockService
 *
 * 1. При старте ищет мерчанта с name === 'test'.
 *    • нет — создаёт (рандомный token) и запоминает id.
 *    • есть — использует существующего.
 * 2. Каждые 1-20 сек создаёт **mock**-транзакцию IN от имени этого мерчанта.
 *    • метод выбирается случайно из enabled; если у мерчанта нет ни одного,
 *      первый попавшийся метод привязывается автоматически.
 */
export default class TestMerchantMockService extends BaseService {
  // базовый интервал — перезаписывается каждый тик на рандом 1-20 сек
  protected interval = 5_000;

  private merchantId!: string;

  /* ───────── one-shot инициализация ───────── */
  protected async onStart(): Promise<void> {
    const name = "test";

    const existing = await db.merchant.findFirst({ where: { name } });
    if (existing) {
      this.merchantId = existing.id;
      console.info(`[MockTx] using merchant "${name}" (${existing.id})`);
      return;
    }

    const merchant = await db.merchant.create({
      data: { name, token: randomBytes(32).toString("hex") },
    });
    this.merchantId = merchant.id;

    console.info(
      `[MockTx] created merchant "${name}" (${merchant.id}) token=${merchant.token}`,
    );
  }

  /* ───────── основной «heartbeat» ───────── */
  protected async tick(): Promise<void> {
    /* --- 1. Метод платежа ------------------------------------------------- */
    // let mMethod = await db.merchantMethod.findFirst({
    //   where: { merchantId: this.merchantId, isEnabled: true },
    //   include: { method: true },
    // });

    // // если у мерчанта нет привязанных методов — берём любой enabled
    // if (!mMethod) {
    //   const anyMethod = await db.method.findFirst({
    //     where: { isEnabled: true },
    //   });
    //   if (!anyMethod) {
    //     console.warn("[MockTx] no enabled methods in DB");
    //     return;
    //   }
    //   mMethod = await db.merchantMethod.create({
    //     data: {
    //       merchantId: this.merchantId,
    //       methodId: anyMethod.id,
    //       isEnabled: true,
    //     },
    //     include: { method: true },
    //   });
    // }
    // const method: Method = mMethod.method;

    // /* --- 2. Пользователь -------------------------------------------------- */
    // let user = await db.user.findFirst();
    // if (!user) {
    //   user = await db.user.create({
    //     data: {
    //       email: `user+${Date.now()}@example.com`,
    //       password: randomBytes(32).toString("hex"),
    //       name: "Test User",
    //       balanceUsdt: 0,
    //       balanceRub: 0,
    //     },
    //   });
    // }

    // /* --- 3. Параметры транзакции ----------------------------------------- */
    // const rnd = (min: number, max: number) => Math.random() * (max - min) + min;

    // const amount = Number(
    //   rnd(method.minPayin ?? 100, method.maxPayin ?? 1_000).toFixed(2),
    // );

    // await db.transaction.create({
    //   data: {
    //     merchantId: this.merchantId,
    //     amount,
    //     assetOrBank: method.code.toUpperCase(),
    //     orderId: randomBytes(8).toString("hex"),
    //     methodId: method.id,
    //     currency: method.currency,
    //     userId: user.id,
    //     userIp: "127.0.0.1",
    //     callbackUri: "https://example.com/callback",
    //     successUri: "https://example.com/success",
    //     failUri: "https://example.com/fail",
    //     type: TransactionType.IN,
    //     expired_at: new Date(Date.now() + 24 * 60 * 60 * 1_000), // +24 ч
    //     commission: method.commissionPayin,
    //     clientName: user.name,
    //     status: Status.CREATED,
    //     rate: null,
    //     isMock: true,
    //   },
    // });

    // console.info('[MockTx] +1 transaction', { amount, method: method.code });

    /* --- 4. Случайная задержка 1-20 сек перед следующим тиком ------------ */
    this.interval = (Math.floor(Math.random() * 20) + 1) * 1_000;
  }
}
