import { randomBytes } from "node:crypto";
export const ADMIN_KEY = randomBytes(32).toString("hex");
export const MASTER_KEY = ADMIN_KEY;
