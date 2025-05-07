// src/services/ExpiredTransactionWatcher.ts
import { BaseService } from './BaseService';
import { db } from '@/db';
import { Status } from '@prisma/client';

/**
 * ExpiredTransactionWatcher
 *
 * • Каждую минуту проверяет таблицу transaction.
 * • Если expired_at < now и статус ещё не EXPIRED — обновляет статус.
 * • Логирует количество «протухших» транзакций.
 */
export default class ExpiredTransactionWatcher extends BaseService {
  protected interval = 10_000; // 10 секунд

  /** Периодическая проверка просроченных транзакций */
  protected async tick(): Promise<void> {
    const now = new Date();

    // выбираем только транзакции, не завершённые ранее
    const { count } = await db.transaction.updateMany({
      where: {
        expired_at: { lt: now },
        status: { not: Status.EXPIRED },
      },
      data: { status: Status.EXPIRED },
    });

    if (count) console.info(`[ExpiredWatcher] marked ${count} tx as EXPIRED`);
  }
}
