# Security notes

## Implemented

| Area | Implementation |
| --- | --- |
| Authentication | Better Auth (maintained library). Database sessions (7 days, rolling); scrypt password hashing; minimum 10 characters; sessions revoked on password reset, role change or deactivation. |
| Authorisation | Role-based permissions are stored in the database (`Role`, `Permission`, `RolePermission`) and checked on the server for every admin route. Roles are never accepted from sign-up input. Admins cannot change their own role. |
| Record access | Customers can only read their own bookings. Guests need the per-booking access token, of which only a SHA-256 hash is stored. "Not yours" and "doesn't exist" return the same 404. References are 40-bit random values. A guest who uses a registered email never gains access to that account's data. |
| Input validation | zod schemas on every API input. The database adds check constraints (amounts, durations, time order, simulated ⇔ demo provider). |
| Pricing integrity | Prices are always computed on the server from database records. Price fields sent by the client are ignored (tested). |
| Double-booking | Per-resource advisory locks plus a re-check inside the transaction, with a PostgreSQL `EXCLUDE USING gist` constraint as the final guarantee (tested with concurrent requests). |
| SQL injection | Prisma parameterised queries. The few raw statements use tagged templates (parameterised). |
| XSS | React escaping, no `dangerouslySetInnerHTML`, and a strict Content-Security-Policy. The API sends `default-src 'none'`. |
| CSRF | SameSite=Lax cookies, plus an Origin/Referer allow-list check on every cookie-authenticated state-changing request (tested). Better Auth checks trusted origins too. |
| CORS | An explicit allow-list (the sites and admin panel plus `CORS_ORIGINS`). |
| Security headers | Helmet on the API. CSP, X-Frame-Options DENY, nosniff, a strict Referrer-Policy, Permissions-Policy and HSTS (in production) on the sites. |
| Rate limiting | Global plus per-route limits, and Better Auth's own sign-in, sign-up and reset limits. |
| Payments | Idempotency keys. Provider payment IDs are unique per type. Amount and currency are checked against the order. The webhook HMAC is checked over the raw body, and events are de-duplicated. A browser redirect or checkout callback is never treated as proof of payment: the API re-fetches the payment from Razorpay. Simulated and real transactions are separated by a database constraint. |
| Secrets | Server environment variables only. Nothing secret reaches the browser; the Razorpay key ID and the Maps embed key are public by design. |
| Logging | Pino redacts cookies, authorization headers, booking tokens and webhook signatures, and drops query strings. The audit log redacts any key that looks like a password, token, secret, card or signature. Webhook payloads are stored redacted. |
| Errors | Unexpected errors return a generic message plus a request ID. Stack traces are never sent to clients. |
| Audit | Administrative changes record the actor, role, action, record, before/after values, IP and timestamp. Only roles with `audit.read` can view them. |

## Residual risks and recommendations before production

- **Email verification is not enforced** (`requireEmailVerification: false`), because no email provider is configured. Enable it once Resend (or another provider) is connected.
- **CSP uses `'unsafe-inline'` for scripts**, which Next.js needs without nonces. Move to nonce-based CSP via middleware for production.
- **Rate limits are in-memory, per process.** Use a shared store (Redis) when running more than one API instance.
- **No CAPTCHA** on public forms. Add Turnstile or reCAPTCHA if abuse appears.
- **Guest tokens in email links:** the token is removed from the address bar on first load and kept in local storage. The Referrer-Policy prevents it leaking to other origins.
- **Admin panel:** consider SSO or 2FA (Better Auth has a two-factor plugin) and network restrictions.
- **Data protection:** the privacy policy and terms are templates. Have the business and its legal adviser review them, along with data retention and the DPDP Act 2023 obligations.
- **Penetration test:** recommended before launch.
