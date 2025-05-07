// src/services/BaseService.ts
/**
 * Base service class that provides a common structure for background services.
 *
 * Наследники могут переопределить:
 *  • interval — период между tick-ами (мс)
 *  • tick()   — главное периодическое действие (обязательный abstract)
 *  • onStart() — опциональная инициализация, вызывается один раз при запуске
 */
export abstract class BaseService {
  /** Период между вызовами tick, мс (переопределяйте в наследниках) */
  protected interval = 5_000;

  private running = false;
  private lastError: Error | null = null;
  private lastTick = 0;

  /** Основная единица работы (должна быть реализована в наследнике) */
  protected abstract tick(): Promise<void>;

  /** Опциональный хук, выполняемый однократно при запуске сервиса */
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  protected async onStart(): Promise<void> {} // no-op по умолчанию

  /** Public health-check accessor */
  status() {
    return {
      name: this.constructor.name,
      healthy: this.running && Date.now() - this.lastTick < this.interval * 2,
      lastTick: new Date(this.lastTick).toISOString(),
      lastError: this.lastError?.message ?? null,
    };
  }

  /** Запускает сервис и периодически вызывает tick() */
  async start(): Promise<void> {
    this.running = true;

    /* --- однократная инициализация --------------------------------------- */
    try {
      await this.onStart();
    } catch (e) {
      this.lastError = e as Error;
      console.error(`[${this.constructor.name}] onStart() error:`, e);
      // можно решить, прерывать ли запуск — здесь не прерываем
    }

    /* --- основной цикл ---------------------------------------------------- */
    while (this.running) {
      try {
        await this.tick();
        this.lastTick = Date.now();
        this.lastError = null;
      } catch (e) {
        this.lastError = e as Error;
        console.error(`[${this.constructor.name}] tick() error:`, e);
      }
      await Bun.sleep(this.interval);
    }
  }

  /** Останавливает выполнение сервиса */
  stop(): void {
    this.running = false;
  }
}
