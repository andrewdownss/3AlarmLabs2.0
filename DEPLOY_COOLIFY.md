# Deploying on Coolify

This guide deploys the full stack from [`docker-compose.yml`](docker-compose.yml): **nginx** (public entry), **frontend** (SvelteKit), **api** (trainer + Socket.IO), **PostgreSQL**, and **Redis**.

General env semantics and Stripe setup are in [`DEPLOY.md`](DEPLOY.md); this file is Coolify-specific.

---

## 1. Prerequisites

- A VPS (or host) with **Coolify** installed and reachable.
- **DNS**: an **A** (or **AAAA**) record pointing your app hostname to the Coolify server (e.g. `app` → `203.0.113.10` for `app.example.com`).
- Ports **80** and **443** open on the server so Coolify can issue TLS certificates.

---

## 2. Create the application in Coolify

1. Open your Coolify dashboard → **Projects** → choose or create a project.
2. **Add resource** → **Docker Compose** (name may vary slightly by Coolify version).
3. Connect this **Git** repository.
4. Set:
   - **Compose file**: `docker-compose.yml`
   - **Branch** you want to deploy (e.g. `main`).
5. Save; Coolify will build and run the stack from the repo.

---

## 3. Public URL (replace placeholders)

Pick one canonical browser URL, always with **`https://`**, for example:

`https://app.example.com`

Use that **exact** value everywhere below for `ORIGIN`, `BETTER_AUTH_BASE_URL`, and the production entry in `CORS_ORIGIN`.

Do **not** substitute the bare hostname without a scheme, and do **not** use `localhost` in production for those variables.

---

## 4. Environment variables in Coolify

In Coolify, add a **shared** environment for the compose stack (or paste a single `.env` Coolify injects at deploy time). Set at least the following.

### Required for production

| Variable | Coolify / production value |
|----------|----------------------------|
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
|----------|--------|
| `API_PORT` | Default `4000` inside the container; compose sets this for `api`. |
| `DATABASE_URL` / `TRAINER_DATABASE_URL` / `REDIS_URL` in a local `.env` | For **full Docker compose**, [`docker-compose.yml`](docker-compose.yml) overrides these so containers use `postgres` and `redis` hostnames. You still need real secrets in Coolify for everything else; DB host in those overrides is **not** `localhost` from inside the stack. |

### PostgreSQL password (recommended before going live)

The sample compose uses `POSTGRES_PASSWORD=postgres`. For production, change the Postgres user password in [`docker-compose.yml`](docker-compose.yml) (and matching URLs) or use Coolify’s **managed Postgres** and point `DATABASE_URL` / `TRAINER_DATABASE_URL` at it—then adjust compose accordingly.

---

## 5. Domain and HTTPS

1. In Coolify, open the **Docker Compose** service list and select **`nginx`** (the service that exposes **port 80**).
2. Attach your **FQDN** (e.g. `app.example.com`).
3. Enable **Let’s Encrypt** / automatic HTTPS (Coolify’s default when a domain is attached).

Traffic flow: **Browser → HTTPS → Coolify proxy → HTTP → nginx:80 → frontend / api**. The repo’s nginx config forwards **`X-Forwarded-Proto`** from the edge proxy so SvelteKit and auth see **https** correctly.

---

## 6. First deploy: database migrations

Before or immediately after the first successful deploy, apply the schema from the **frontend** package (same as [`DEPLOY.md`](DEPLOY.md)):

```bash
cd frontend && npx drizzle-kit push
```

Use the **same** `DATABASE_URL` the app uses in production (from the Postgres service Coolify runs, or your managed DB). You can run this from your laptop with a tunnel, from a one-off Coolify container, or from CI.

---

## 7. Stripe

1. **Webhook URL**: `https://app.example.com/api/stripe/webhook` (use your real host).
2. **Events**: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`.
3. Enable the **Customer portal** in Stripe Billing so “Manage billing” works.

---

## 8. Security hardening (recommended)

- **Do not expose** Postgres (`5432`) or Redis (`6379`) on the public internet. The sample [`docker-compose.yml`](docker-compose.yml) publishes those ports for local convenience; for Coolify production, remove those `ports:` blocks from `postgres` and `redis` (or use a prod-only override compose) so only **nginx** is public.
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
| WebSocket / Command fails | Domain must point at **nginx**; Coolify should allow upgrade headers (nginx already proxies `Upgrade` for `/` and `/socket.io/`). |
| Auth URLs still show `http://localhost` | Redeploy after setting `BETTER_AUTH_BASE_URL`; frontend image bakes auth base URL at **build** time from that variable. |
| 502 / containers unhealthy | Check Coolify logs for `frontend`, `api`, `postgres`, `redis`; confirm Postgres is healthy before the app starts. |

---

## 11. Quick checklist

- [ ] DNS A/AAAA record → Coolify server  
- [ ] Coolify **Docker Compose** resource → this repo, `docker-compose.yml`  
- [ ] All secrets and Stripe price IDs set in Coolify env  
- [ ] `ORIGIN`, `BETTER_AUTH_BASE_URL`, `CORS_ORIGIN` = your **`https://…`** URL  
- [ ] Domain attached to **`nginx`**, TLS enabled  
- [ ] `drizzle-kit push` (or equivalent) run against production DB  
- [ ] Stripe webhook URL and events configured  
- [ ] (Recommended) Remove public `5432` / `6379` mappings for production  
