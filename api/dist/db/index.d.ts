import * as trainerSchema from "./schema/trainer.js";
export declare const db: import("drizzle-orm/node-postgres").NodePgDatabase<typeof trainerSchema> & {
    $client: import("pg").Pool;
};
export { trainerSchema };
//# sourceMappingURL=index.d.ts.map