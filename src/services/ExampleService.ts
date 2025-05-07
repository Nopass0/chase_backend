// src/services/ExampleService.ts
import { BaseService } from './BaseService';

/**
 * ExampleService — демонстрирует работу BaseService
 */
export class ExampleService extends BaseService {
  protected interval = 10_000; // 10 секунд

  /** Однократная инициализация */
  protected async onStart(): Promise<void> {
    console.info('[ExampleService] started ✔︎');
    // здесь можно открыть соединения, загрузить кэш и т.д.
  }

  /** Периодическое действие */
  protected async tick(): Promise<void> {
    // console.info('[ExampleService] heartbeat');
  }
}
