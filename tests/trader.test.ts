import { expect, it, describe, beforeAll, afterAll } from 'bun:test';
import { Elysia } from 'elysia';
import { db } from '@/db';
import { Status, TransactionType } from '@prisma/client';
import traderRoutes from '@/routes/trader';
import { randomBytes } from 'node:crypto';

// Мок для middleware traderGuard
const mockTraderGuard = () => (app: Elysia) =>
  app
    .derive(() => {
      return {
        trader: {
          id: 'test-trader-id',
          email: 'test-trader@example.com',
          name: 'Test Trader',
          balanceUsdt: 1000,
          balanceRub: 50000,
          banned: false,
          createdAt: new Date(),
          password: 'hash',
          trafficEnabled: true
        }
      };
    });

// Мок для заголовков запроса
const mockHeaders = {
  'x-trader-token': 'test-token'
};

// Тестовый экземпляр приложения
const app = new Elysia()
  .use(mockTraderGuard())
  .use(traderRoutes);

describe('Маршруты трейдера', () => {
  let testTransactionId: string;
  
  // Создаем тестовые данные перед запуском тестов
  beforeAll(async () => {
    // Создаем тестового мерчанта
    const merchant = await db.merchant.create({
      data: {
        name: 'Test Merchant',
        token: randomBytes(16).toString('hex'),
        disabled: false,
        banned: false
      }
    });
    
    // Создаем тестовый метод
    const method = await db.method.create({
      data: {
        code: 'test-method',
        name: 'Test Method',
        type: 'c2c',
        commissionPayin: 0.01,
        commissionPayout: 0.02,
        maxPayin: 10000,
        minPayin: 100,
        maxPayout: 10000,
        minPayout: 100,
        chancePayin: 0.95,
        chancePayout: 0.95,
        isEnabled: true
      }
    });
    
    // Создаем тестовую транзакцию
    const transaction = await db.transaction.create({
      data: {
        merchantId: merchant.id,
        amount: 1000,
        assetOrBank: 'USDT',
        orderId: 'test-order-' + randomBytes(4).toString('hex'),
        methodId: method.id,
        userId: 'test-user-id',
        callbackUri: 'https://example.com/callback',
        successUri: 'https://example.com/success',
        failUri: 'https://example.com/fail',
        type: TransactionType.IN,
        expired_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
        commission: 10,
        clientName: 'Test Client',
        status: Status.CREATED,
        traderId: 'test-trader-id'
      }
    });
    
    testTransactionId = transaction.id;
  });
  
  // Удаляем тестовые данные после завершения тестов
  afterAll(async () => {
    await db.transaction.deleteMany({
      where: { traderId: 'test-trader-id' }
    });
    await db.method.deleteMany({
      where: { code: 'test-method' }
    });
    await db.merchant.deleteMany({
      where: { name: 'Test Merchant' }
    });
  });
  
  it('GET /transactions должен возвращать список транзакций трейдера', async () => {
    const response = await app.handle(
      new Request('http://localhost/transactions', {
        headers: mockHeaders
      })
    );
    
    expect(response.status).toBe(200);
    
    const body = await response.json();
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('pagination');
    expect(Array.isArray(body.data)).toBe(true);
  });
  
  it('GET /transactions/:id должен возвращать детали транзакции', async () => {
    const response = await app.handle(
      new Request(`http://localhost/transactions/${testTransactionId}`, {
        headers: mockHeaders
      })
    );
    
    expect(response.status).toBe(200);
    
    const body = await response.json();
    expect(body).toHaveProperty('id', testTransactionId);
    expect(body).toHaveProperty('traderId', 'test-trader-id');
  });
  
  it('PATCH /transactions/:id/status должен обновлять статус транзакции', async () => {
    const response = await app.handle(
      new Request(`http://localhost/transactions/${testTransactionId}/status`, {
        method: 'PATCH',
        headers: {
          ...mockHeaders,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: Status.READY
        })
      })
    );
    
    expect(response.status).toBe(200);
    
    const body = await response.json();
    expect(body).toHaveProperty('success', true);
    expect(body).toHaveProperty('transaction');
    expect(body.transaction).toHaveProperty('status', Status.READY);
  });
});