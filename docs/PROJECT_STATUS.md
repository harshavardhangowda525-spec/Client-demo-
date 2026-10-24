# Project status

**Scope:** three websites, a shared API and database, a booking/availability/pricing engine, a payment architecture and a central admin panel. The mobile app is **out of scope** for this task, but the API is ready for it: bearer tokens and OpenAPI are in place.
**Overall:** ready for demonstration. Every external integration runs in a clearly labelled demo or preview mode until the client supplies credentials.

## Feature status

Status key: ✅ = implemented and covered by automated tests; 🟡 = implemented, with a limitation noted; ⛔ = not done (depends on someone outside this task).

| Area | Feature | Status | Notes |
| --- | --- | --- | --- |
| Photography site | Home, photography, videography, portfolio + filters, project detail, packages, studio/locations, booking, about, FAQs, contact, booking status, privacy, terms, account | ✅ | The About page and legal pages are clearly marked templates |
| Podcast site | Home, studio overview, facilities (no invented specs), services, packages, locations, availability calendar, booking, gallery, FAQs, contact, booking status, account | ✅ | |
| Events site | Home, services, categories, packages, gallery, venues, enquiry form, consultation booking, enquiry status (accept/decline proposals), FAQs, contact, booking status, account | ✅ | Enquiries are never bookings |
| Design | Three distinct token-based themes, responsive layout, focus styles, reduced motion, skip links | ✅ | axe WCAG 2.1 AA scans pass on 11 key pages |
| Imagery | 24 AI-generated sample images (Floot), lazy-loaded responsive WebP, committed to the repo | ✅ | Labelled as AI-generated sample imagery |
| Booking engine | Server-side date, duration and opening-hours validation; lead time and advance window; resource allocation; buffers; holds with expiry; status machine; history; reschedule | ✅ | |
| Conflict prevention | Advisory locks, in-transaction re-check and a PostgreSQL exclusion constraint | ✅ | Tested with 8 concurrent requests for one slot |
| Pricing | Fixed, hourly, packages, add-ons (fixed or per hour), discounts, configurable fees, tax and deposits, custom quotations, itemised breakdown | ✅ | All values are samples |
| Enquiries & quotations | Review, assign, follow-ups, versioned quotations, send, customer or staff response, expiry, conversion with availability check | ✅ | |
| Payments | Demo provider (simulated) + Razorpay adapter (orders, checkout signature, API re-fetch, signed webhooks, refunds), idempotency, real/simulated separation | 🟡 | Razorpay code paths are unit-tested with signed payloads, but **not verified against Razorpay** (no credentials) |
| Accounts | Register, sign in/out, profile, booking/enquiry/payment history, password reset | 🟡 | Reset and verification emails are previews only (no email provider). Email verification is not enforced. |
| Admin | Dashboard (computed live), bookings, enquiries/quotations, customers, payments/refunds, services/packages/add-ons/categories, locations/resources/hours/blocks, content/FAQs/messages, configuration, integrations, notifications, audit log, staff roles | ✅ | |
| Notifications | Email/SMS/WhatsApp/push adapters with truthful statuses and a preview inbox | 🟡 | No provider is configured. Bookings send email only. |
| Maps | Embed adapter | 🟡 | Not configured. Shows addresses only, and never a map for demo locations. |
| Security | See [SECURITY.md](SECURITY.md) | ✅ | Residual risks are listed there |
| Mobile app | | ⛔ | Out of scope for this task |

## Tests executed

All of these were run in this environment on 24 Oct 2026 against PostgreSQL 16.

| Suite | Result |
| --- | --- |
| `pnpm --filter @studio/core test` (Vitest, unit + DB integration) | **71 passed** (6 files) |
| `pnpm --filter @studio/api test` (Vitest, HTTP integration) | **17 passed** |
| `pnpm test:e2e` (Playwright on the **production builds**: 3 websites + admin + axe accessibility) | **26 passed** |
| `pnpm lint` (ESLint) | 0 errors, 0 warnings |
| `pnpm typecheck` and `tsc` on the packages | passed |
| `pnpm build` (API + 4 Next.js apps) | 5/5 successful |

These were **not** run: load or performance tests, cross-browser runs (Chromium only), real-device mobile testing, manual screen-reader testing, live Razorpay/Resend/Twilio/Maps calls (no credentials) and a penetration test.

## Known issues and limitations

- **Expired holds** are released lazily, when availability is read or a booking is created. Add a one-minute scheduled job in production.
- **Rate limiting** is per process. Use Redis when scaling horizontally.
- **Delivery callbacks** for email and SMS (`DELIVERED` status) are not wired yet.
- **Customer refunds** are initiated by staff. There is no automated refund rule, because the cancellation policy has not been provided.
- **Multiple currencies** are modelled but untested; everything is in INR.
- The **package tiers** on the events site (Essentials / Signature / Bespoke) are a sample structure without prices, since pricing is by quotation.
- **Demo bookings** in *awaiting payment* expire 30 minutes after seeding, as designed. Re-seed to restore them.
- **Changing the Prisma schema** auto-generates migrations that may try to drop the hand-written constraints (the exclusion constraint and partial unique indexes). Review each generated migration before applying it.

## External dependencies and information needed from the client

1. Final brand names, logos, colours (if they differ), copy and verified imagery.
2. The real service list, packages, prices, tax treatment (GST rate and HSN/SAC codes), deposit and cancellation/refund policy.
3. Addresses, opening hours, rooms/venues with capacities, and verified equipment specifications.
4. Razorpay account (key ID/secret, webhook secret) and the settlement/refund policy.
5. Email provider and sender domain. SMS (DLT-registered sender) and WhatsApp Business templates, if wanted.
6. Google Maps API key, if maps are wanted.
7. A legally reviewed privacy policy and terms.
8. Hosting choice, domains and production database.
