import { Elysia } from "elysia";
import merchantRoutes from "@/routes/merchant/index";

/**
 * Группа маршрутов для мерчантов
 * Все эндпоинты защищены проверкой токена мерчанта
 */
export default (app: Elysia) => app.use(merchantRoutes);