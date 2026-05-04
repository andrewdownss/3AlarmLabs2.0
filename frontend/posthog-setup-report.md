<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics into this SvelteKit application. Here is a summary of all changes made:

**New files created:**
- `src/hooks.client.ts` — Initializes PostHog with the `/ingest` reverse proxy and captures client-side exceptions automatically via `handleError`.
- `src/lib/server/posthog.ts` — Singleton server-side PostHog client using `posthog-node`.

**Modified files:**
- `svelte.config.js` — Added `paths.relative = false` (required for PostHog session replay to work correctly with SSR).
- `src/hooks.server.ts` — Added a `/ingest` reverse-proxy handle (routes PostHog traffic through your own domain to avoid ad blockers), plus a `handleError` export for server-side exception capture.
- `src/routes/app/+layout.svelte` — Calls `posthog.identify()` on every authenticated page load to link PostHog sessions to your database user IDs.
- `src/lib/components/app-sidebar.svelte` — Calls `posthog.reset()` on logout to unlink the PostHog session from the user identity.
- `src/routes/login/+page.server.ts` — Captures `user_logged_in` server-side after successful authentication.
- `src/routes/signup/+page.server.ts` — Captures `user_signed_up` server-side after successful registration.
- `src/routes/app/sizeup/scenes/new/+page.server.ts` — Captures `scene_created` server-side when a new SizeUp scene is created.
- `src/routes/app/command/scenarios/new/+page.server.ts` — Captures `scenario_created` server-side when a new Command scenario is created.
- `src/routes/app/sizeup/scenes/[id]/edit/+page.svelte` — Captures `scene_saved` client-side when scene overlays are saved.
- `src/routes/app/settings/billing/+page.svelte` — Captures `checkout_started` client-side when a user initiates Stripe checkout.
- `src/routes/app/command/sessions/[id]/instruct/+page.svelte` — Captures `simulation_started` and `simulation_ended` client-side in the live instructor session view.
- `src/routes/api/stripe/webhook/+server.ts` — Captures `subscription_activated` and `subscription_cancelled` server-side from Stripe webhook events.

**Environment variables:**
> **Action required:** Add these two variables to your root `.env` file (at `3AlarmLabs3.1/.env`, one level above `frontend/`), since `svelte.config.js` reads environment variables from that directory:
> ```
> PUBLIC_POSTHOG_PROJECT_TOKEN=<your_posthog_project_token>
> PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
> ```
> Your project token can be found in your [PostHog project settings](/settings/project).

## Events tracked

| Event | Description | File |
|---|---|---|
| `user_signed_up` | User successfully created a new account | `src/routes/signup/+page.server.ts` |
| `user_logged_in` | User successfully logged into their account | `src/routes/login/+page.server.ts` |
| `scene_created` | User created a new SizeUp scene | `src/routes/app/sizeup/scenes/new/+page.server.ts` |
| `scene_saved` | User saved overlay edits to a SizeUp scene | `src/routes/app/sizeup/scenes/[id]/edit/+page.svelte` |
| `checkout_started` | User initiated a Stripe checkout for a plan upgrade | `src/routes/app/settings/billing/+page.svelte` |
| `subscription_activated` | Stripe checkout completed and subscription applied | `src/routes/api/stripe/webhook/+server.ts` |
| `subscription_cancelled` | Stripe subscription deleted/cancelled | `src/routes/api/stripe/webhook/+server.ts` |
| `scenario_created` | User created a new Command training scenario | `src/routes/app/command/scenarios/new/+page.server.ts` |
| `simulation_started` | Instructor started a live training simulation | `src/routes/app/command/sessions/[id]/instruct/+page.svelte` |
| `simulation_ended` | Instructor ended a live training simulation | `src/routes/app/command/sessions/[id]/instruct/+page.svelte` |

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- [Analytics basics dashboard](/dashboard/1542669)
- [New Signups & Logins Over Time](/insights/h1zgxU8e)
- [Signup → Subscription Conversion Funnel](/insights/FJ6knM2z)
- [SizeUp Scene Activity](/insights/BcI0fEWn)
- [Command Training Simulations](/insights/39vi0Efh)
- [Subscription Activations vs Cancellations](/insights/TkOSWWHw)

### Agent skill

We've left an agent skill folder in your project at `.claude/skills/integration-sveltekit/`. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
