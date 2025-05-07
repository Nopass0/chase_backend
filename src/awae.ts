// import { db } from '@/db';
// import { randomBytes } from 'node:crypto';
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

// /**
//  * Сервис для работы с криптокошельками TRC20
//  */
// export class WalletService {
//   /**
//    * Создает новый TRC20 кошелек и привязывает его к пользователю
//    * @param userId ID пользователя
//    * @returns Объект с данными кошелька
//    */
//   static async createWalletForUser(userId: string) {
//     try {
//       // Генерация нового кошелька
//       const account = await tronWeb.createAccount();
      
//       // Сохранение кошелька в базе данных
//       const wallet = await db.cryptoWallet.create({
//         data: {
//           address: account.address.base58,
//           userId,
//           isActive: true,
//         },
//       });
      
//       // Сохранение приватного ключа в безопасном хранилище (в реальном приложении)
//       // В данном примере мы просто логируем его, но в продакшене нужно использовать
//       // безопасное хранилище, например, AWS KMS или HashiCorp Vault
//       console.log(`Created wallet for user ${userId}: ${account.address.base58}`);
//       console.log(`Private key (SECURE THIS!): ${account.privateKey}`);
      
//       // Возвращаем данные кошелька
//       return {
//         id: wallet.id,
//         address: wallet.address,
//         isActive: wallet.isActive,
//         createdAt: wallet.createdAt.toISOString(),
//         updatedAt: wallet.updatedAt.toISOString(),
//       };
//     } catch (error) {
//       console.error('Error creating wallet:', error);
//       throw new Error('Не удалось создать криптокошелек');
//     }
//   }
  
//   /**
//    * Проверяет баланс кошелька
//    * @param address Адрес кошелька
//    * @returns Баланс в TRX и USDT
//    */
//   static async checkBalance(address: string) {
//     try {
//       // Получение баланса TRX
//       const trxBalance = await tronWeb.trx.getBalance(address);
//       const trxBalanceInTrx = tronWeb.fromSun(trxBalance);
      
//       // Получение баланса USDT (TRC20)
//       // Адрес контракта USDT TRC20
//       const usdtContractAddress = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'; // Mainnet USDT
//       const contract = await tronWeb.contract().at(usdtContractAddress);
//       const usdtBalance = await contract.balanceOf(address).call();
//       const usdtBalanceFormatted = usdtBalance / 1e6; // USDT имеет 6 десятичных знаков
      
//       return {
//         trx: Number(trxBalanceInTrx),
//         usdt: Number(usdtBalanceFormatted)
//       };
//     } catch (error) {
//       console.error('Error checking balance:', error);
//       throw new Error('Не удалось проверить баланс кошелька');
//     }
//   }
  
//   /**
//    * Переводит все средства с кошелька пользователя на главный кошелек
//    * @param fromAddress Адрес кошелька пользователя
//    * @param privateKey Приватный ключ кошелька пользователя
//    * @returns Результат транзакции
//    */
//   static async transferToMainWallet(fromAddress: string, privateKey: string) {
//     try {
//       // Создаем экземпляр TronWeb с приватным ключом отправителя
//       const userTronWeb = new TronWeb({
//         fullHost: getFullHost(),
//         headers: { "TRON-PRO-API-KEY": TRON_PRO_API_KEY },
//         privateKey: privateKey
//       });
      
//       // Проверяем баланс USDT
//       const usdtContractAddress = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
//       const contract = await userTronWeb.contract().at(usdtContractAddress);
//       const usdtBalance = await contract.balanceOf(fromAddress).call();
      
//       if (usdtBalance > 0) {
//         // Отправляем все USDT на главный кошелек
//         const transaction = await contract.transfer(
//           MAIN_WALLET_ADDRESS,
//           usdtBalance
//         ).send();
        
//         return {
//           success: true,
//           transactionId: transaction,
//           amount: usdtBalance / 1e6,
//           token: 'USDT'
//         };
//       }
      
//       return {
//         success: false,
//         message: 'Недостаточно средств для перевода'
//       };
//     } catch (error) {
//       console.error('Error transferring to main wallet:', error);
//       throw new Error('Не удалось перевести средства на главный кошелек');
//     }
//   }
// }