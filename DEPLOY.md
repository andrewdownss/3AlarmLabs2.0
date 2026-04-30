# Deploying 3AlarmLabs

## Environment variables

### Frontend (SvelteKit)

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string |
| `BETTER_AUTH_SECRET` | Random secret for sessions |
| `BETTER_AUTH_BASE_URL` | Public site URL, e.g. `https://your-domain.com` |
| `ORIGIN` | Same as public URL (see `svelte.config` / adapter) |
| `STRIPE_SECRET_KEY` | Stripe secret key (`sk_live_…` or `sk_test_…`) |
| `STRIPE_WEBHOOK_SECRET` | Signing secret from Stripe webhook endpoint (`whsec_…`) |
| `STRIPE_PRICE_INDIVIDUAL_MONTHLY` | Stripe Price ID for Individual monthly ($14.99/mo; app adds a 7-day trial) |
| `STRIPE_PRICE_SMALL_FIREHOUSE_ANNUAL` | Stripe Price ID for Small Firehouse annual |
| `STRIPE_PRICE_MEDIUM_FIREHOUSE_ANNUAL` | Stripe Price ID for Medium Firehouse annual |
| `STRIPE_PRICE_LARGE_FIREHOUSE_ANNUAL` | Stripe Price ID for Large Firehouse annual |
| `UPLOADTHING_TOKEN` | UploadThing API token |
| `SENDGRID_API_KEY` | Email delivery (invites, etc.) |
| `FROM_EMAIL` | Verified sender address |
| `PUBLIC_GOOGLE_MAPS_API_KEY` | Maps JavaScript API key (Street View) |

Create recurring **Products / Prices** in the [Stripe Dashboard](https://dashboard.stripe.com) for each row above. Individual uses a monthly interval; firehouse tiers use annual intervals.

### Stripe webhooks

- URL: `https://your-domain.com/api/stripe/webhook`
- Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
- Enable **Customer portal** in Stripe Billing settings so “Manage billing” works.

### Trainer API

| Variable | Purpose |
|----------|---------|
| `TRAINER_DATABASE_URL` | Same database as frontend |
| `REDIS_URL` | Redis for Socket.IO adapter |
| `OPENAI_API_KEY` | Transcription + command parsing |
| `API_PORT` | Listen port (default 4000) |

## TLS and reverse proxy

Production must use **HTTPS**. Set `BETTER_AUTH_BASE_URL` and cookie `Secure` behavior to match.

For deployment, expose **only** the `frontend` service publicly (port 3000 inside the Docker network). The frontend’s Node server proxies:

- `/api/trainer/*` → the `api` service
- `/socket.io/*` → the `api` service (WebSocket upgrades)

## Database

Run Drizzle migrations from `frontend` before first deploy:

```bash
cd frontend && npx drizzle-kit push
```

Back up Postgres on a schedule; test restore periodically.

## Smoke tests after deploy

1. Sign up from Individual pricing → confirm checkout starts a 7-day trial and creates a personal workspace.
2. Stripe test card checkout → webhook updates plan on organization.
3. Open Command self-practice and (on Team+) instructor-led.
4. Billing portal opens for org owner with an active Stripe customer.

## Email

Verify the sender domain in SendGrid (or provider) so invites and auth email deliver.

## Monitoring

Point uptime checks at `/` and optionally `GET /health` on the trainer API. Watch application logs for Stripe webhook failures and OpenAI errors.
