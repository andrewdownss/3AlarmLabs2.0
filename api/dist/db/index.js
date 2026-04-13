import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as trainerSchema from "./schema/trainer.js";
import { env } from "../config/env.js";
function parsePoolInt(value, fallback) {
    if (value === undefined || value === "")
        return fallback;
    const n = Number.parseInt(value, 10);
    return Number.isFinite(n) && n > 0 ? n : fallback;
}
const pool = new pg.Pool({
    connectionString: env.TRAINER_DATABASE_URL,
    max: parsePoolInt(env.DATABASE_POOL_MAX, 20),
    idleTimeoutMillis: parsePoolInt(env.DATABASE_POOL_IDLE_MS, 30_000),
    connectionTimeoutMillis: parsePoolInt(env.DATABASE_POOL_CONNECTION_TIMEOUT_MS, 10_000)
});
export const db = drizzle(pool, { schema: trainerSchema });
export { trainerSchema };
//# sourceMappingURL=index.js.map