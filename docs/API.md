# API documentation

The shared API serves the four websites, the admin panel and, later, the mobile app.

- **Base URL (local):** `http://localhost:4000`. The websites reach it through their own `/api/*` proxy.
- **Machine-readable spec:** [`openapi.json`](openapi.json), regenerated with `pnpm --filter @studio/api openapi`, or live at `GET /api/openapi.json`. It is generated from the same zod schemas that validate requests, so it cannot drift from the implementation.
- **Format:** JSON. Money is always an integer in **minor units** (paise for INR). Timestamps are ISO-8601 UTC. Dates are `YYYY-MM-DD` and times are `HH:MM` in the location's timezone.
- **Errors:** `{"error": {"code": "...", "message": "...", "details"?: [{"path": "...", "message": "..."}]}}`. Possible codes: `VALIDATION` (400), `UNAUTHENTICATED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404), `CONFLICT` / `UNAVAILABLE` / `INVALID_TRANSITION` (409), `RATE_LIMITED` (429), `INTEGRATION_NOT_CONFIGURED` (503) and `INTERNAL` (500, which returns a `requestId` and no internals).

## Authentication

[Better Auth](https://better-auth.com) runs under `/api/auth/*`:

| Endpoint | Purpose |
| --- | --- |
| `POST /api/auth/sign-up/email` `{name,email,password}` | Register. The account always gets the `customer` role; the role cannot be set from input. |
| `POST /api/auth/sign-in/email` `{email,password}` | Sign in. Sets an httpOnly `studio.session_token` cookie and returns a `token`. |
| `POST /api/auth/sign-out` | End the session |
| `GET /api/auth/get-session` | Current session |
| `POST /api/auth/request-password-reset` `{email, redirectTo}` | Reset link (a preview only, unless email is configured) |
| `POST /api/auth/reset-password` `{newPassword, token}` | Complete the reset |

**Browsers** use the session cookie. A state-changing request that carries a cookie must come from an allowed origin; that is the CSRF check.
**The mobile app** can send `Authorization: Bearer <token>` instead (Better Auth bearer plugin). Bearer requests are not subject to the origin check.

## Guest access to bookings

Creating a booking or enquiry returns a one-time `accessToken`. Only its SHA-256 hash is stored. Send it as the `X-Booking-Token` header to read, pay for or cancel that booking without an account. References (`PH-7K3Q9XMR`) are random and not sequential, and on their own they never reveal private data. `POST /api/v1/bookings/lookup` with reference + email returns only a minimal status summary.

## Endpoint overview

### Public catalogue and content
`GET /api/v1/sites/{brand}` (site configuration and integration flags) · `/catalog` · `/services/{slug}` · `/locations` · `/portfolio[?category=]` · `/portfolio/{slug}` · `/faqs`. Here `brand` is one of `PHOTO`, `PODCAST`, `EVENTS` (and `STUDIO` for the site configuration and FAQs of the Infinity Studios platform).

### Booking engine
| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/v1/availability?serviceId&locationId&date&days&(packageId\|durationMin)` | Verified slots per day (max 42 days). Uses the same engine as booking creation. |
| POST | `/api/v1/quotes` | Itemised server-side price. Any price fields sent by the client are ignored. |
| POST | `/api/v1/bookings` | Creates a reservation and returns `{booking, accessToken}`. Status is `AWAITING_PAYMENT` (with a hold), `ENQUIRY_SUBMITTED` (review services) or `AWAITING_REVIEW`. Never `CONFIRMED`. |
| POST | `/api/v1/bookings/lookup` | Reference + email → minimal summary |
| GET | `/api/v1/bookings/{reference}` | Owner, staff, or `X-Booking-Token` |
| POST | `/api/v1/bookings/{reference}/cancel` | Cancels an unpaid booking directly; for a paid booking it records a cancellation request |

### Payments
| Method | Path | Notes |
| --- | --- | --- |
| POST | `/api/v1/bookings/{reference}/payments` `{purpose: DEPOSIT\|FULL\|BALANCE}` + `Idempotency-Key` | Creates a payment order and returns checkout details. A repeated key returns the same order. |
| POST | `/api/v1/payments/demo/{orderId}/simulate` `{outcome}` | **Demo mode only.** Simulates the provider's verdict; the result is flagged `isSimulated`. |
| POST | `/api/v1/payments/razorpay/{orderId}/confirm` | Verifies the checkout signature, then fetches the payment from Razorpay before recording it |
| POST | `/api/v1/webhooks/razorpay` | HMAC-SHA256 over the raw body (`X-Razorpay-Signature`), de-duplicated by `X-Razorpay-Event-Id` |

### Enquiries
`POST /api/v1/enquiries` · `GET /api/v1/enquiries/{reference}` · `POST /api/v1/enquiries/{reference}/quotations/{id}/respond` `{decision: ACCEPT|DECLINE}`

### Infinity Studios platform (public)
| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/v1/studio/home[?city=]` | Banners, categories, popular services (by bookings in the last 90 days) with the **real** next free slot, featured services, packages, equipment, portfolio, authorised testimonials, FAQs |
| GET | `/api/v1/studio/search?q=` | Services, packages, categories and equipment; multi-word queries match all words |
| GET | `/api/v1/studio/categories` · `/studio/cities` | Browse categories; cities with an active studio location |
| GET | `/api/v1/studio/services?category&q&city&minPrice&maxPrice&maxDuration&equipment&type&date&sort&page&pageSize` | Listing with filters (`date` = has a free slot that day), sorting and pagination, plus facets |
| GET | `/api/v1/studio/services/{slug}` · `/studio/portfolio[?category=]` · `/studio/pages/{slug}` | Service detail; portfolio with videos; policy pages |
| POST | `/api/v1/studio/enquiries` | Project brief for a custom quotation (never a booking). Services from both brands in one brief are rejected. Returns `{reference, accessToken}`. |
| POST | `/api/v1/enquiries/{reference}/attachments` | Multipart field `file`, with `X-Booking-Token`. PDF/JPG/PNG/WebP, detected from the content; max 10 MB each, 5 per enquiry. |
| POST | `/api/v1/bookings/{reference}/reschedule-requests` `{date, startTime, reason?}` | Asks to move a booking. The original slot stays reserved until staff approve; requests close 48 hours before the session (configurable). |

### Account (signed in)
`GET /api/v1/me` · `PATCH /api/v1/me/profile` · `GET /api/v1/me/bookings` · `/me/enquiries` · `/me/payments` · `GET /me/saved`, `PUT|DELETE /me/saved/{serviceId}` · `GET|PATCH /me/preferences` (email/WhatsApp; WhatsApp requires explicit consent)

### Admin (`/api/v1/admin/*`, permission-checked on the server)
Dashboard · bookings (search, detail, `transition`, `reschedule`, `notes`) · catalogue (services, packages, add-ons, categories) · locations, resources, `opening-hours`, `blocked-periods` · customers · enquiries (update, follow-ups, quotations: save draft / send / respond / convert) · payments and `transactions/{id}/refund` · settings · integrations (`verify`) · audit · notifications · portfolio, FAQs, contact messages · staff and users · **studio site:** `banners`, `discovery-categories`, `equipment`, `testimonials` (publishing requires recorded authorisation), `pages/{slug}`, notification `templates/{key}` (unknown placeholders rejected), `reschedule-requests` (+ `/{id}/decide`), `reminders/run`, `attachments/{id}` (staff-only download, never rendered inline).
The OpenAPI document lists the permission each endpoint requires.

## Rate limits

300 requests per minute per visitor IP globally (`RATE_LIMIT_PER_MINUTE`). The websites forward the visitor's IP on their server-side API calls, so the limit applies per visitor rather than per web server. Stricter limits apply to booking creation (20 per 10 min), lookup (10 per 15 min), enquiries (10 per 10 min), contact (5 per 10 min) and sign-in (8 per min).
