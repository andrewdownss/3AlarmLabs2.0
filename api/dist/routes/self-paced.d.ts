import type { Server } from 'socket.io';
export declare function createSelfPacedRouter(io: Server): import("express-serve-static-core").Router;
/**
 * Background poller that ticks every active self-paced session and fires
 * any due assignment-completion follow-ups. Single-process, single-node;
 * for multi-replica deployments wrap with a Postgres advisory lock.
 */
export declare function startSelfPacedPoller(io: Server, intervalMs?: number): NodeJS.Timeout;
//# sourceMappingURL=self-paced.d.ts.map