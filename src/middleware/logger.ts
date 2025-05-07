import { Elysia } from "elysia";
import chalk from "chalk";

const file = Bun.file("logs/api.log");
const writer = file.writer({ append: true });

export const loggerMiddleware = new Elysia().on(
  "response",
  async ({
    request,
    set,
  }: {
    request: { method: string; url: string };
    set: { status?: number };
  }) => {
    const { method, url } = request;
    const status = set.status ?? 200;
    const timestamp = new Date().toISOString();

    // pretty console
    console.log(
      `${chalk.gray(timestamp)} ${chalk.cyan(method)} ${chalk.yellow(status.toString())} ${url}`,
    );

    // persistent log
    writer.write(`${timestamp} ${method} ${status} ${url}\n`);
    await writer.flush();
  },
);
