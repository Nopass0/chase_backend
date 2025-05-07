// import { db } from '@/db';
// import { WalletService } from './walletService';
// import TronWeb from 'tronweb';

// // Конфигурация TronWeb
// const TRON_PRO_API_KEY = process.env.TRON_PRO_API_KEY || '';
// const TRON_NETWORK = process.env.TRON_NETWORK || 'mainnet';
// const MAIN_WALLET_ADDRESS = process.env.MAIN_WALLET_ADDRESS || '';
// const MAIN_WALLET_PRIVATE_KEY = process.env.MAIN_WALLET_PRIVATE_KEY || '';

// // Настройка сети Tron в зависимости от окружения
// const getFullHost = () => {
//   if (TRON_NETWORK === 'testnet') {
//     return 'https://api.shasta.trongrid.io';
//   }
//   return 'https://api.trongrid.io';
// };

// // Инициализация TronWeb
// const tronWeb = new TronWeb({
//   fullHost: getFullHost(),
//   headers: { "TRON-PRO-API-KEY": TRON_PRO_API_KEY },
//   privateKey: MAIN_WALLET_PRIVATE_KEY
// });

// // Адрес контракта USDT TRC20
// const USDT_CONTRACT_ADDRESS = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'; // Mainnet USDT

// /**
//  * Сервис для мониторинга криптокошельков TRC20
//  * Отслеживает пополнения, зачисляет средства пользователям и переводит их на главный кошелек
//  */
// export class WalletMonitorService {
//   private static isRunning = false;
//   private static monitoringInterval: NodeJS.Timeout | null = null;
//   private static readonly POLLING_INTERVAL = 60000; // 1 минута
//   private static readonly WALLET_KEYS_STORAGE: Record<string, string> = {}; // В реальном приложении использовать безопасное хранилище

//   /**
//    * Запускает сервис мониторинга кошельков
//    */
//   static async startMonitoring() {
//     if (this.isRunning) {
//       console.log('Мониторинг кошельков уже запущен');
//       return;
//     }

//     console.log('Запуск мониторинга кошельков...');
//     this.isRunning = true;

//     // Запускаем периодическую проверку кошельков
//     this.monitoringInterval = setInterval(async () => {
//       try {
//         await this.checkAllWallets();
//       } catch (error) {
//         console.error('Ошибка при проверке кошельков:', error);
//       }
//     }, this.POLLING_INTERVAL);

//     // Выполняем первую проверку сразу
//     try {
//       await this.checkAllWallets();
//     } catch (error) {
//       console.error('Ошибка при первичной проверке кошельков:', error);
//     }
//   }

//   /**
//    * Останавливает сервис мониторинга кошельков
//    */
//   static stopMonitoring() {
//     if (!this.isRunning) {
//       console.log('Мониторинг кошельков не запущен');
//       return;
//     }

//     console.log('Остановка мониторинга кошельков...');
//     if (this.monitoringInterval) {
//       clearInterval(this.monitoringInterval);
//       this.monitoringInterval = null;
//     }
//     this.isRunning = false;
//   }

//   /**
//    * Проверяет все активные кошельки пользователей
//    */
//   private static async checkAllWallets() {
//     console.log('Проверка всех активных кошельков...');
    
//     // Получаем все активные кошельки из базы данных
//     const wallets = await db.cryptoWallet.findMany({
//       where: { isActive: true },
//       include: { user: true }
//     });

//     console.log(`Найдено ${wallets.length} активных кошельков`);

//     // Проверяем каждый кошелек
//     for (const wallet of wallets) {
//       try {
//         await this.processWallet(wallet);
//       } catch (error) {
//         console.error(`Ошибка при обработке кошелька ${wallet.address}:`, error);
//       }
//     }
//   }

//   /**
//    * Обрабатывает отдельный кошелек
//    * @param wallet Кошелек для обработки
//    */
//   private static async processWallet(wallet: any) {
//     console.log(`Обработка кошелька ${wallet.address} пользователя ${wallet.user.email}`);
    
//     try {
//       // Получаем последнюю известную транзакцию для этого кошелька
//       const lastTransaction = await db.walletTransaction.findFirst({
//         where: { walletId: wallet.id },
//         orderBy: { timestamp: 'desc' }
//       });

//       // Получаем новые транзакции с USDT
//       const newTransactions = await this.getNewUsdtTransactions(
//         wallet.address, 
//         lastTransaction?.externalTxId
//       );

//       if (newTransactions.length === 0) {
//         console.log(`Новых транзакций для кошелька ${wallet.address} не найдено`);
//         return;
//       }

//       console.log(`Найдено ${newTransactions.length} новых транзакций для кошелька ${wallet.address}`);

//       // Обрабатываем каждую новую транзакцию
//       for (const tx of newTransactions) {
//         await this.processTransaction(wallet, tx);
//       }

//       // Переводим средства на главный кошелек
//       await this.transferToMainWallet(wallet);
//     } catch (error) {
//       console.error(`Ошибка при обработке кошелька ${wallet.address}:`, error);
//     }
//   }

//   /**
//    * Получает новые USDT транзакции для кошелька
//    * @param address Адрес кошелька
//    * @param lastTxId ID последней обработанной транзакции
//    * @returns Массив новых транзакций
//    */
//   private static async getNewUsdtTransactions(address: string, lastTxId?: string) {
//     try {
//       // Получаем контракт USDT
//       const contract = await tronWeb.contract().at(USDT_CONTRACT_ADDRESS);
      
//       // Получаем события Transfer для адреса
//       // В реальном приложении нужно использовать более надежный способ получения транзакций,
//       // например, через TronGrid API с пагинацией и фильтрацией по времени
//       const events = await tronWeb.getEventResult(USDT_CONTRACT_ADDRESS, {
//         eventName: 'Transfer',
//         size: 50,
//         onlyConfirmed: true,
//       });

//       // Фильтруем транзакции, где получатель - наш адрес
//       const incomingTransactions = events.filter((event: any) => {
//         return event.result.to === address && 
//                (!lastTxId || event.transaction !== lastTxId);
//       });

//       // Преобразуем в удобный формат
//       return incomingTransactions.map((event: any) => ({
//         txId: event.transaction,
//         from: event.result.from,
//         to: event.result.to,
//         amount: event.result.value / 1e6, // Конвертируем в USDT (6 десятичных знаков)
//         timestamp: event.timestamp
//       }));
//     } catch (error) {
//       console.error(`Ошибка при получении транзакций для ${address}:`, error);
//       return [];
//     }
//   }

//   /**
//    * Обрабатывает новую транзакцию
//    * @param wallet Кошелек получателя
//    * @param transaction Данные транзакции
//    */
//   private static async processTransaction(wallet: any, transaction: any) {
//     console.log(`Обработка транзакции ${transaction.txId} на сумму ${transaction.amount} USDT`);
    
//     try {
//       // Проверяем, не обрабатывали ли мы уже эту транзакцию
//       const existingTx = await db.walletTransaction.findUnique({
//         where: { externalTxId: transaction.txId }
//       });

//       if (existingTx) {
//         console.log(`Транзакция ${transaction.txId} уже была обработана ранее`);
//         return;
//       }

//       // Начинаем транзакцию в базе данных
//       await db.$transaction(async (prisma) => {
//         // Создаем запись о транзакции
//         await prisma.walletTransaction.create({
//           data: {
//             externalTxId: transaction.txId,
//             walletId: wallet.id,
//             amount: transaction.amount,
//             senderAddress: transaction.from,
//             timestamp: new Date(transaction.timestamp),
//             status: 'COMPLETED',
//             type: 'USER_DEPOSIT' // Специальное обозначение для пополнений от пользователя
//           }
//         });

//         // Обновляем баланс пользователя
//         await prisma.user.update({
//           where: { id: wallet.userId },
//           data: {
//             balanceUsdt: { increment: transaction.amount }
//           }
//         });

//         console.log(`Баланс пользователя ${wallet.user.email} увеличен на ${transaction.amount} USDT`);
//       });
//     } catch (error) {
//       console.error(`Ошибка при обработке транзакции ${transaction.txId}:`, error);
//     }
//   }

//   /**
//    * Переводит средства с кошелька пользователя на главный кошелек
//    * @param wallet Кошелек пользователя
//    */
//   private static async transferToMainWallet(wallet: any) {
//     try {
//       // В реальном приложении приватные ключи должны храниться в безопасном хранилище
//       // Здесь мы используем упрощенный подход для демонстрации
//       const privateKey = this.WALLET_KEYS_STORAGE[wallet.id];
//       if (!privateKey) {
//         console.log(`Приватный ключ для кошелька ${wallet.address} не найден`);
//         return;
//       }

//       // Проверяем баланс кошелька
//       const balance = await WalletService.checkBalance(wallet.address);
      
//       if (balance.usdt <= 0) {
//         console.log(`На кошельке ${wallet.address} недостаточно USDT для перевода`);
//         return;
//       }

//       console.log(`Перевод ${balance.usdt} USDT с кошелька ${wallet.address} на главный кошелек ${MAIN_WALLET_ADDRESS}`);
      
//       // Выполняем перевод на главный кошелек
//       const result = await WalletService.transferToMainWallet(wallet.address, privateKey);
      
//       if (result.success) {
//         console.log(`Успешно переведено ${result.amount} USDT на главный кошелек. TX: ${result.transactionId}`);
        
//         // Записываем транзакцию в базу данных
//         await db.walletTransaction.create({
//           data: {
//             externalTxId: result.transactionId,
//             walletId: wallet.id,
//             amount: result.amount,
//             receiverAddress: MAIN_WALLET_ADDRESS,
//             timestamp: new Date(),
//             status: 'COMPLETED',
//             type: 'TRANSFER_TO_MAIN'
//           }
//         });
//       } else {
//         console.log(`Не удалось перевести средства: ${result.message}`);
//       }
//     } catch (error) {
//       console.error(`Ошибка при переводе средств с кошелька ${wallet.address}:`, error);
//     }
//   }

//   /**
//    * Сохраняет приватный ключ для кошелька
//    * В реальном приложении должен использоваться безопасный способ хранения ключей
//    * @param walletId ID кошелька
//    * @param privateKey Приватный ключ
//    */
//   static saveWalletKey(walletId: string, privateKey: string) {
//     this.WALLET_KEYS_STORAGE[walletId] = privateKey;
//   }
// }