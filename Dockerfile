services:
  # Runs once per `compose up`: pushes Drizzle schema to Postgres, then exits.
  # Requires Docker Compose v2.20+ for `service_completed_successfully`.
  db-migrate:
    build:
      context: ./frontend
      dockerfile: Dockerfile
      target: migrate
    env_file:
      - .env
    environment:
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/threealarmlabs
    depends_on:
      postgres:
        condition: service_healthy
    restart: "no"
    networks:
      - default

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
      args:
        BETTER_AUTH_SECRET: ${BETTER_AUTH_SECRET}
        BETTER_AUTH_BASE_URL_BUILD: ${BETTER_AUTH_BASE_URL}
    env_file:
      - .env
    environment:
      NODE_ENV: production
      PORT: 3000
      API_INTERNAL_URL: http://api:4000
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/threealarmlabs
      ORIGIN: ${ORIGIN}
      BETTER_AUTH_BASE_URL: ${BETTER_AUTH_BASE_URL}
    depends_on:
      postgres:
        condition: service_healthy
      db-migrate:
        condition: service_completed_successfully
    restart: unless-stopped
    networks:
      - dokploy-network
      - default

  api:
    build:
      context: ./api
      dockerfile: Dockerfile
    env_file:
      - .env
    environment:
      NODE_ENV: production
      API_PORT: 4000
      REDIS_URL: redis://redis:6379
      TRAINER_DATABASE_URL: postgresql://postgres:postgres@postgres:5432/threealarmlabs
      CORS_ORIGIN: ${CORS_ORIGIN}
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      db-migrate:
        condition: service_completed_successfully
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: threealarmlabs
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    volumes:
      - postgres-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d threealarmlabs"]
      interval: 10s
      timeout: 5s
      retries: 10
    restart: unless-stopped

volumes:
  postgres-data:

networks:
  dokploy-network:
    external: true
