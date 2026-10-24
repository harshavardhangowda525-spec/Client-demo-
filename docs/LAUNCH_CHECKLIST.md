# Production launch checklist

## Content and business
- [ ] Replace every sample service, package, price, add-on, tax rate, deposit rule and cancellation policy (Admin → Services, Configuration). Untick "sample" only once the data is verified.
- [ ] Replace demo locations, hours and resources with verified data; untick "Demonstration location".
- [ ] Replace AI sample imagery with licensed or owned photographs; untick "sample" on portfolio projects.
- [ ] Final brand names, contact details and About copy.
- [ ] Legal review of the privacy notice and terms; publish the final versions.
- [ ] Remove the demo banner (`DemoBar`) and the demo-account hint on the sign-in panels.

## Data
- [ ] Production PostgreSQL with backups and PITR. Run `pnpm db:migrate`; **do not seed**.
- [ ] Create a real administrator (register, then promote via SQL or an existing admin); delete or deactivate the demo accounts.
- [ ] Data-retention policy for customer records, audit logs and notifications.

## Integrations
- [ ] Razorpay live keys and webhook secret; set `PAYMENTS_MODE=live`. In Admin → Integrations, choose **Verify now**. Run a real low-value payment and a refund end to end.
- [ ] Email provider configured and verified; enable `requireEmailVerification`.
- [ ] (Optional) SMS/WhatsApp with approved templates; Maps embed key.
- [ ] Set `NOTIFICATION_PREVIEWS=false` in production.

## Security and operations
- [ ] HTTPS on every domain; real `SITE_URL_*`, `BETTER_AUTH_URL`, `CORS_ORIGINS`, `TRUST_PROXY`.
- [ ] Strong `BETTER_AUTH_SECRET` held in a secret manager.
- [ ] Shared rate-limit store (Redis) if running more than one API instance.
- [ ] Scheduled job for `expireStaleHolds()` every minute.
- [ ] Nonce-based CSP. Consider 2FA or SSO for staff, and IP restrictions for the admin panel.
- [ ] Error monitoring (e.g. Sentry) and uptime checks on `/api/health`.
- [ ] Penetration test and dependency audit (`pnpm audit`).

## Quality
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build` pass in CI.
- [ ] `pnpm test:e2e` passes against staging.
- [ ] Cross-browser checks (Safari/iOS, Firefox) and real-device mobile checks.
- [ ] Manual accessibility review (keyboard, screen reader).
- [ ] Load test for availability and booking creation.
