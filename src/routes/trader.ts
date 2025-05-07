import { Elysia } from "elysia";
import traderRoutes from "./trader/index";

/**
 * Маршруты для трейдера
 * Позволяют трейдеру просматривать и управлять транзакциями, криптокошельками и реквизитами
 */
export default (app: Elysia) => app.use(traderRoutes);