import { Elysia, t } from "elysia";
import { traderGuard } from "@/middleware/traderGuard";
import walletRoutes from "./wallet";
import transactionsRoutes from "./transactions";
import bankDetailsRoutes from "./bank-details";
import ErrorSchema from "@/types/error";

/**
 * Маршруты для трейдера
 * Объединяет все подмаршруты для трейдера в один модуль
 */
export default (app: Elysia) =>
  app
    .use(traderGuard())
    .group("/wallet", (app) => walletRoutes(app))
    .group("/transactions", (app) => transactionsRoutes(app))
    .group("/bank-details", (app) => bankDetailsRoutes(app))
    .get(
      "/profile",
      async ({ trader }) => {
        return {
          id: trader.id,
          email: trader.email,
          name: trader.name,
          balanceUsdt: trader.balanceUsdt,
          balanceRub: trader.balanceRub,
          trafficEnabled: trader.trafficEnabled,
          createdAt: trader.createdAt.toISOString(),
        };
      },
      {
        tags: ["trader"],
        detail: { summary: "Получение профиля трейдера" },
        response: {
          200: t.Object({
            id: t.String(),
            email: t.String(),
            name: t.String(),
            balanceUsdt: t.Number(),
            balanceRub: t.Number(),
            trafficEnabled: t.Boolean(),
            createdAt: t.String(),
          }),
          401: ErrorSchema,
          403: ErrorSchema,
        },
      },
    );