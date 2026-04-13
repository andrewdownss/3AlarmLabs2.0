/** 100 req/min per IP across all /api/trainer/* routes */
export declare const globalLimiter: import("express-rate-limit").RateLimitRequestHandler;
/** 10 req/min per authenticated user for the radio (OpenAI) endpoint */
export declare const radioLimiter: import("express-rate-limit").RateLimitRequestHandler;
//# sourceMappingURL=rate-limit.d.ts.map