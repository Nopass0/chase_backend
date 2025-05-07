import "elysia";

declare module "elysia" {
  interface ElysiaContext {
    ip: string;
  }
}

import type { Merchant } from '@prisma/client';

declare module 'elysia' {
  interface Context {
    merchant: Merchant;
  }
}
