import { t } from "elysia";

/* ------------------------------------------------------------
 * Общая схема ошибки JSON { error: string }
 * ------------------------------------------------------------ */
const ErrorSchema = t.Object({ error: t.String() });
export default ErrorSchema;
