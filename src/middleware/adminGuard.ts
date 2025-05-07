import { Elysia, t } from "elysia";
import { ip } from "elysia-ip";
import { db } from "@/db";

/**
 * adminGuard — middleware‑защита для административных эндпоинтов.
 *
 * Ошибки, которые может вернуть guard:
 *  • **403 Forbidden IP** — клиент обращается из IP‑адреса, не входящего в whitelist.
 *  • **401 Invalid admin key** — в заголовке `x-admin-key` отсутствует известный токен админа
 *    и не передан master‑key супер‑админа.
 */
export const adminGuard =
  (masterKey: string, whitelist: string[]) => (app: Elysia) =>
    app.use(ip()).guard({
      async beforeHandle({ ip: clientIp, request, error }) {
        if (!whitelist.includes(clientIp))
          return error(403, { error: "Forbidden IP" });

        const key = request.headers.get("x-admin-key") ?? "";
        if (key === masterKey) return; // супер‑админ имеет полный доступ

        const subadmin = await db.admin.findFirst({ where: { token: key } });
        if (!subadmin) return error(401, { error: "Invalid admin key" });
      },
    });
