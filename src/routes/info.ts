import { Elysia, t } from "elysia";

export default (app: Elysia) =>
  app.get(
    "/connection",
    /* ─────────  Handler  ───────── */
    ({ request, ip }) => ({
      ip,
      userAgent: request.headers.get("user-agent") ?? "unknown",
    }),
    {
      /* ───────── Swagger / OpenAPI (рус.) ───────── */
      tags: ["info"],
      detail: {
        description:
          "Эндпоинт health-check. Возвращает IP-адрес клиента и строку User-Agent, что позволяет мониторингу или балансировщику убедиться, что экземпляр API отвечает.",
      },
      response: {
        200: t.Object(
          {
            ip: t.String({
              description: "IP-адрес клиента, как его видит сервер",
            }),
            userAgent: t.String({
              description: "Значение заголовка User-Agent из запроса",
            }),
          },
          { description: "Сервер доступен" },
        ),
      },
    },
  );
