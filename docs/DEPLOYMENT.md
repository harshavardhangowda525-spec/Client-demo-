# Deployment

The platform is five Node.js processes and one PostgreSQL database. Nothing in it depends on a particular vendor.

| Service | Build | Start | Notes |
| --- | --- | --- | --- |
| API | `pnpm --filter @studio/api build` | `node apps/api/dist/server.js` | Stateless. Run 2+ instances behind a load balancer. |
| Websites ×3 / Admin | `pnpm --filter @studio/<app> build` | `next start -p <port>` | Server-rendered on every request (live data) |
| Database | `pnpm db:migrate` | | Managed PostgreSQL 14+ with `btree_gist` |

## Recommended topology

```
photo.example.com   ─┐
podcast.example.com ─┼─▶ Next.js servers ──(/api/*, /media/* rewrite)──▶ API ──▶ PostgreSQL
events.example.com  ─┤                                                  │
admin.example.com   ─┘                                                  └─▶ Razorpay / Resend / Twilio
```

- Each website proxies `/api/*` to `API_INTERNAL_URL` (private network), so auth cookies are first-party on every domain.
- Set `SITE_URL_*`, `BETTER_AUTH_URL` (the API's public URL, used in reset/verification links) and `CORS_ORIGINS` to the real domains.
- Set `TRUST_PROXY` to match your proxy chain, so rate limits and audit IPs use the client IP.
- Serve everything over HTTPS. Cookies become `Secure` automatically when `BETTER_AUTH_URL` is `https://`, and HSTS is sent in production.
- Put the admin panel behind an additional network control (VPN, IP allow-list or SSO) if possible.

## Release procedure

1. `pnpm install --frozen-lockfile`
2. `pnpm lint && pnpm typecheck && pnpm test`
3. `pnpm build`
4. `pnpm db:migrate`. Review every new migration first: hand-written constraints (the exclusion constraint and the partial unique indexes) must not be dropped by an auto-generated migration.
5. Start the processes. Health check: `GET /api/health`.
6. Run `pnpm test:e2e` against staging.

**Never run `pnpm db:seed` against production.** It refuses when `NODE_ENV=production`, and it refuses when real bookings exist.

## Scheduled work

Expired payment holds are released lazily, whenever availability is read or a booking is made. Production should also call `expireStaleHolds()` every minute (a cron job or worker), so dashboards stay accurate during quiet periods. This is listed in the launch checklist.

## Backups

Enable point-in-time recovery on the database. Bookings, payments and audit logs are the system of record.
