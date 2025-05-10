import { Elysia } from "elysia";
import { swagger } from "@elysiajs/swagger";
import { jwt } from "@elysiajs/jwt";
import { cors } from "@elysiajs/cors";
import { ip } from "elysia-ip";
import { JWTHandler } from "@/utils/types";

import { loggerMiddleware } from "@/middleware/logger";
import { adminGuard } from "@/middleware/adminGuard";
import userRoutes from "@/routes/user";
import infoRoutes from "@/routes/info";
import adminRoutes from "@/routes/admin";
import merchantRoutes from "@/routes/merchant";
import traderRoutes from "@/routes/trader";
import deviceRoutes from "@/routes/trader/device";

import { Glob } from "bun";
import { pathToFileURL } from "node:url";
import { BaseService } from "@/services/BaseService";
import { join } from "node:path"; // ← нужно для join()
import { MASTER_KEY } from "@/utils/constants";
import { merchantGuard } from "./middleware/merchantGuard";

// ────────────────────────────────────────────────────────────────
// Dynamic admin key generated per run
// ────────────────────────────────────────────────────────────────
console.info(`\u2728 Admin key for this session: ${MASTER_KEY}`);

// Allowed IPs for admin – extend via env/config
const ADMIN_IP_WHITELIST = [
  "127.0.0.1",
  "::1", // чистый IPv6-loopback
  "::ffff:127.0.0.1", // IPv4-через IPv6 (так Bun часто отдаёт)
  "95.163.152.102",
  "77.91.84.94",
];

// ── Auto-discover & start every service in /services ────────────

const services: BaseService[] = [];

const scanRoot = join(import.meta.dir, "services"); // src/services абс. путь
const glob = new Glob("*.ts");

// 2) просим Glob отдать абсолютные пути
for await (const file of glob.scan({ cwd: scanRoot, absolute: true })) {
  if (file.endsWith("BaseService.ts")) continue;

  // 3) абсолютная строка → file:// URL → динамический import()
  const mod = await import(pathToFileURL(file).href);

  const Service = mod.default ?? Object.values(mod)[0];
  if (
    typeof Service === "function" &&
    Service.prototype instanceof BaseService
  ) {
    const instance = new Service();
    instance.start();
    services.push(instance);
    console.info(`[Service] started ${Service.name}`);
  }
}

// Main application instance
const app = new Elysia({ prefix: "/api" })
  .derive(() => {
    services;
  })
  .use(ip())
  .use(cors())
  .use(
    swagger({
      path: "/docs",
      documentation: {
        info: {
          title: "API P2P Платежей",
          version: "1.0.0",
          description: "API для p2p платежей Chase",
        },
        tags: [
          {
            name: "user",
            description: "Аутентификация и профиль пользователя",
          },
          {
            name: "info",
            description: "Информация о состоянии сервиса и соединении",
          },
          {
            name: "admin",
            description: "Административные эндпоинты (защищенные IP и ключом)",
          },
          {
            name: "merchant",
            description: "Эндпоинты для мерчантов (защищенные API-ключом)",
          },
          {
            name: "trader",
            description: "Эндпоинты для трейдеров (защищенные токеном сессии)",
          },
          {
            name: "device",
            description: "Эндпоинты для устройств (защищенные токеном устройства)",
          },
        ],
      },
    }),
  )
  .use(
    jwt({
      name: "jwt",
      secret: Bun.env.JWT_SECRET!,
      exp: "24h",
    }),
  )
  .use(loggerMiddleware)
  // ── Feature groups ────────────────────────────────────────────
  .group("/user", (app) => app.use(userRoutes))
  .group("/info", (app) => app.use(infoRoutes))
  .group(
    "/admin",
    // adminGuard(ADMIN_KEY, ADMIN_IP_WHITELIST), // ← плагин-guard
    (g) => g.use(adminGuard(MASTER_KEY, ADMIN_IP_WHITELIST)).use(adminRoutes), // ← сами эндпоинты
  )
  .group("/merchant", (app) => app.use(merchantGuard()).use(merchantRoutes))
  .group("/device", (app) => app.use(deviceRoutes))
  .group("/trader", (app) => app.use(traderRoutes))
  .listen(Bun.env.PORT ?? 3000);

console.log(`🚀  Server listening on http://localhost:${app.server?.port}`);
