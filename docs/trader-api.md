# API Трейдера

## Обзор

API трейдера предоставляет доступ к функциональности управления транзакциями, где пользователь выступает в роли трейдера. Трейдер может просматривать список своих транзакций, получать детальную информацию о конкретной транзакции и изменять статус транзакций.

## Аутентификация

Все запросы к API трейдера должны содержать заголовок `x-trader-token` с действительным токеном сессии пользователя.

```
x-trader-token: <токен_сессии>
```

Токен сессии можно получить через стандартный процесс аутентификации пользователя (`POST /api/user/auth`).

## Эндпоинты

### Получение списка транзакций

```
GET /api/trader/transactions
```

#### Параметры запроса

| Параметр | Тип    | Описание                                      |
|----------|--------|-----------------------------------------------|
| page     | number | Номер страницы (по умолчанию: 1)              |
| limit    | number | Количество записей на странице (по умолчанию: 10) |
| status   | string | Фильтр по статусу транзакции (опционально)    |
| type     | string | Фильтр по типу транзакции (опционально)       |

#### Пример ответа

```json
{
  "data": [
    {
      "id": "clq123abc",
      "numericId": 123,
      "merchantId": "clm456def",
      "amount": 1000,
      "assetOrBank": "USDT",
      "orderId": "order-123",
      "methodId": "mth789ghi",
      "currency": "usdt",
      "userId": "usr101jkl",
      "userIp": "192.168.1.1",
      "callbackUri": "https://example.com/callback",
      "successUri": "https://example.com/success",
      "failUri": "https://example.com/fail",
      "type": "IN",
      "expired_at": "2023-12-31T23:59:59.999Z",
      "commission": 10,
      "clientName": "Иван Иванов",
      "status": "CREATED",
      "rate": 90.5,
      "traderId": "trd202mno",
      "isMock": false,
      "createdAt": "2023-12-01T12:00:00.000Z",
      "updatedAt": "2023-12-01T12:00:00.000Z",
      "merchant": {
        "id": "clm456def",
        "name": "Тестовый мерчант"
      },
      "method": {
        "id": "mth789ghi",
        "name": "Тестовый метод",
        "type": "c2c"
      },
      "receipts": [
        {
          "id": "rcp303pqr",
          "fileName": "receipt.jpg",
          "isChecked": false,
          "isFake": false
        }
      ]
    }
  ],
  "pagination": {
    "total": 50,
    "page": 1,
    "limit": 10,
    "pages": 5
  }
}
```

### Получение информации о конкретной транзакции

```
GET /api/trader/transactions/:id
```

#### Параметры пути

| Параметр | Тип    | Описание                |
|----------|--------|-------------------------|
| id       | string | Идентификатор транзакции |

#### Пример ответа

```json
{
  "id": "clq123abc",
  "numericId": 123,
  "merchantId": "clm456def",
  "amount": 1000,
  "assetOrBank": "USDT",
  "orderId": "order-123",
  "methodId": "mth789ghi",
  "currency": "usdt",
  "userId": "usr101jkl",
  "userIp": "192.168.1.1",
  "callbackUri": "https://example.com/callback",
  "successUri": "https://example.com/success",
  "failUri": "https://example.com/fail",
  "type": "IN",
  "expired_at": "2023-12-31T23:59:59.999Z",
  "commission": 10,
  "clientName": "Иван Иванов",
  "status": "CREATED",
  "rate": 90.5,
  "traderId": "trd202mno",
  "isMock": false,
  "createdAt": "2023-12-01T12:00:00.000Z",
  "updatedAt": "2023-12-01T12:00:00.000Z",
  "merchant": {
    "id": "clm456def",
    "name": "Тестовый мерчант",
    "token": "merchant-token-xyz",
    "disabled": false,
    "banned": false,
    "createdAt": "2023-11-01T00:00:00.000Z"
  },
  "method": {
    "id": "mth789ghi",
    "code": "test-method",
    "name": "Тестовый метод",
    "type": "c2c",
    "currency": "usdt",
    "commissionPayin": 0.01,
    "commissionPayout": 0.02,
    "maxPayin": 10000,
    "minPayin": 100,
    "maxPayout": 10000,
    "minPayout": 100,
    "chancePayin": 0.95,
    "chancePayout": 0.95,
    "isEnabled": true,
    "rateSource": "bybit"
  },
  "receipts": [
    {
      "id": "rcp303pqr",
      "transactionId": "clq123abc",
      "fileData": "base64-encoded-data",
      "fileName": "receipt.jpg",
      "isChecked": false,
      "isFake": false,
      "isAuto": false,
      "createdAt": "2023-12-01T12:05:00.000Z",
      "updatedAt": "2023-12-01T12:05:00.000Z"
    }
  ]
}
```

### Обновление статуса транзакции

```
PATCH /api/trader/transactions/:id/status
```

#### Параметры пути

| Параметр | Тип    | Описание                |
|----------|--------|-------------------------|
| id       | string | Идентификатор транзакции |

#### Тело запроса

```json
{
  "status": "READY"
}
```

#### Возможные значения статуса

- `CREATED` - Создана
- `DISPUTE` - Спор
- `EXPIRED` - Истекла
- `READY` - Готова
- `CANCELED` - Отменена

#### Пример ответа

```json
{
  "success": true,
  "transaction": {
    "id": "clq123abc",
    "status": "READY",
    "updatedAt": "2023-12-01T15:30:00.000Z"
  }
}
```

## Коды ошибок

| Код  | Описание                                       |
|------|------------------------------------------------|
| 400  | Неверный запрос или невозможно изменить статус |
| 401  | Ошибка аутентификации (неверный токен)         |
| 403  | Доступ запрещен (пользователь заблокирован)    |
| 404  | Транзакция не найдена                          |

## Примеры использования

### Получение списка транзакций со статусом CREATED

```bash
curl -X GET "http://localhost:3000/api/trader/transactions?status=CREATED" \
  -H "x-trader-token: ваш_токен_сессии"
```

### Изменение статуса транзакции на READY

```bash
curl -X PATCH "http://localhost:3000/api/trader/transactions/clq123abc/status" \
  -H "Content-Type: application/json" \
  -H "x-trader-token: ваш_токен_сессии" \
  -d '{"status": "READY"}'
```