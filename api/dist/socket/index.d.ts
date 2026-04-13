import { Server as SocketServer } from 'socket.io';
import type { Server } from 'http';
/** Single-node Socket.io. For multiple API replicas, add the Redis adapter and sticky sessions at the load balancer. */
export declare function createSocketServer(httpServer: Server): SocketServer<import("socket.io").DefaultEventsMap, import("socket.io").DefaultEventsMap, import("socket.io").DefaultEventsMap, any>;
//# sourceMappingURL=index.d.ts.map