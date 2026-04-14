# Deploying on Dokploy (no nginx)

This guide deploys the full stack from [`docker-compose.yml`](docker-compose.yml) on **Dokploy** using a **single public service**:

- **frontend** (SvelteKit Node server, public entry)
- **api** (trainer + Socket.IO, internal only)
- **PostgreSQL**
- **Redis**

The `frontend` container proxies traffic to the `api` container for:

- `/api/trainer/*`
- `/socket.io/*` (WebSockets)

General env semantics and Stripe setup are in [`DEPLOY.md`](DEPLOY.md); this file is Dokploy-specific.

---

## 1. Prerequisites

- A VPS (or host) with **Dokploy** installed and reachable.
- **DNS**: an **A** (or **AAAA**) record pointing your app hostname to the Dokploy server (e.g. `app` → `203.0.113.10` for `app.example.com`).
- Ports **80** and **443** open on the server so Dokploy can issue TLS certificates.

---

## 2. Create the application in Dokploy

1. In Dokploy, create a new app from this Git repository.
2. Choose **Docker Compose** (or “compose deployment”) and select `docker-compose.yml`.
3. Ensure Dokploy attaches the stack to its external network (this repo expects `dokploy-network` as an **external** network defined in `docker-compose.yml`).
4. Deploy; Dokploy will build images and start the stack.

---

## 3. Public URL (replace placeholders)

Pick one canonical browser URL, always with **`https://`**, for example:

`https://app.example.com`

Use that **exact** value everywhere below for `ORIGIN`, `BETTER_AUTH_BASE_URL`, and the production entry in `CORS_ORIGIN`.

Do **not** substitute the bare hostname without a scheme, and do **not** use `localhost` in production for those variables.

---

## 4. Environment variables in Dokploy

In Dokploy, add environment variables for the compose stack (or paste a single `.env` Dokploy injects at deploy time). Set at least the following.

### Required for production

| Variable | Production value |
|----------|------------------|
| `BETTER_AUTH_SECRET` | Strong secret (e.g. `openssl rand -base64 32`). Same value is used as a Docker **build arg** for the frontend image. |
| `BETTER_AUTH_BASE_URL` | Your public URL, e.g. `https://app.example.com`. Feeds runtime **and** build (`BETTER_AUTH_BASE_URL_BUILD` in compose). |
| `ORIGIN` | Same as `BETTER_AUTH_BASE_URL`. |
| `CORS_ORIGIN` | Origins allowed by the API (comma-separated). Include your public URL, e.g. `https://app.example.com`. Add `http://localhost:5173` only if you still need local dev against this API. |
| `STRIPE_SECRET_KEY` | From Stripe Dashboard. |
| `STRIPE_WEBHOOK_SECRET` | Signing secret for your production webhook endpoint. |
| `STRIPE_PRICE_*` | Six price IDs (see [`DEPLOY.md`](DEPLOY.md)). |
| `UPLOADTHING_TOKEN` | UploadThing token. |
| `SENDGRID_API_KEY` | SendGrid (or compatible) API key. |
| `FROM_EMAIL` | Verified sender (e.g. `noreply@yourdomain.com`). |
| `PUBLIC_GOOGLE_MAPS_API_KEY` | Google Maps JavaScript API key. |
| `OPENAI_API_KEY` | For trainer transcription / commands. |

### Optional / defaults

| Variable | Notes |
|----------|-------|
| `API_PORT` | Default `4000` inside the container; compose sets this for `api`. |
| `API_INTERNAL_URL` | Defaults to `http://api:4000` (set by compose for `frontend`). |
| `DATABASE_URL` / `TRAINER_DATABASE_URL` / `REDIS_URL` in a local `.env` | For **full Docker compose**, [`docker-compose.yml`](docker-compose.yml) overrides these so containers use `postgres` and `redis` hostnames. You still need real secrets in Dokploy for everything else; DB host in those overrides is **not** `localhost` from inside the stack. |

### PostgreSQL password (recommended before going live)

The sample compose uses `POSTGRES_PASSWORD=postgres`. For production, change the Postgres user password in [`docker-compose.yml`](docker-compose.yml) (and matching URLs) or use Dokploy’s managed database offering and point `DATABASE_URL` / `TRAINER_DATABASE_URL` at it—then adjust compose accordingly.

---

## 5. Domain and HTTPS

1. In Dokploy, attach your **FQDN** (e.g. `app.example.com`) to the **`frontend`** service.
2. Enable **Let’s Encrypt** / automatic HTTPS in Dokploy.

Traffic flow: **Browser → HTTPS → Dokploy/Traefik → HTTP → frontend:3000 → (proxy) api:4000**.

---

## 6. First deploy: database migrations

Before or immediately after the first successful deploy, apply the schema from the **frontend** package (same as [`DEPLOY.md`](DEPLOY.md)):

```bash
cd frontend && npx drizzle-kit push
```

Use the **same** `DATABASE_URL` the app uses in production (from the Postgres service Dokploy runs, or your managed DB). You can run this from your laptop with a tunnel, from a one-off Dokploy container, or from CI.

---

## 7. Stripe

1. **Webhook URL**: `https://app.example.com/api/stripe/webhook` (use your real host).
2. **Events**: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`.
3. Enable the **Customer portal** in Stripe Billing so “Manage billing” works.

---

## 8. Security hardening (recommended)

- **Do not expose** Postgres (`5432`) or Redis (`6379`) on the public internet. For Dokploy production, keep only **frontend** public and avoid publishing DB/cache ports.
- Rotate `POSTGRES_PASSWORD` and any API keys if they were ever committed or leaked.

---

## 9. Smoke tests

After deploy, run through [`DEPLOY.md`](DEPLOY.md) smoke tests: sign-up, org creation, Stripe checkout, webhooks, Command / Socket.IO, billing portal, email delivery.

---

## 10. Troubleshooting

| Symptom | What to check |
|---------|----------------|
| Redirect loops or cookies not sticking | `ORIGIN` and `BETTER_AUTH_BASE_URL` must be the **https** public URL, identical to the address users type. |
| CORS errors on API | `CORS_ORIGIN` must include your site’s **https** origin. |
| WebSocket / Command fails | Ensure the domain routes to **frontend** and that Dokploy allows WebSocket upgrades to the `frontend` service. Frontend proxies `/socket.io/*` to the API. |
| Auth URLs still show `http://localhost` | Redeploy after setting `BETTER_AUTH_BASE_URL`; frontend image bakes auth base URL at **build** time from that variable. |
| 502 / containers unhealthy | Check Dokploy logs for `frontend`, `api`, `postgres`, `redis`; confirm Postgres is healthy before the app starts. |

---

## 11. Quick checklist

- [ ] DNS A/AAAA record → Dokploy server  \n+- [ ] Dokploy **Docker Compose** app → this repo, `docker-compose.yml`  \n+- [ ] All secrets and Stripe price IDs set in Dokploy env  \n+- [ ] `ORIGIN`, `BETTER_AUTH_BASE_URL`, `CORS_ORIGIN` = your **`https://…`** URL  \n+- [ ] Domain attached to **`frontend`**, TLS enabled  \n+- [ ] `drizzle-kit push` (or equivalent) run against production DB  \n+- [ ] Stripe webhook URL and events configured  \n+- [ ] (Recommended) Avoid public `5432` / `6379` mappings for production\n*** End Patch"}]}commentary to=functions.ApplyPatch})
