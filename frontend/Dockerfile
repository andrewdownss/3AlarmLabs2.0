FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
ARG DATABASE_URL_BUILD=postgresql://postgres:postgres@127.0.0.1:5432/threealarmlabs
ENV DATABASE_URL=$DATABASE_URL_BUILD
ARG BETTER_AUTH_SECRET
ENV BETTER_AUTH_SECRET=$BETTER_AUTH_SECRET
ARG BETTER_AUTH_BASE_URL_BUILD=http://localhost
ENV BETTER_AUTH_BASE_URL=$BETTER_AUTH_BASE_URL_BUILD
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
COPY --from=builder /app/build ./build
COPY --from=builder /app/server.js ./server.js
COPY --from=builder /app/package.json ./package.json
COPY --from=deps /app/node_modules ./node_modules
EXPOSE 3000
CMD ["node", "server.js"]
