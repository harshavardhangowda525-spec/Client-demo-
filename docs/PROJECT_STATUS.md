# Project status

**Scope:** four websites (three brand sites plus the Infinity Studios discovery platform), a shared API and database, a booking/availability/pricing engine, a payment architecture and a central admin panel. The mobile app is **out of scope** for this task, but the API is ready for it: bearer tokens and OpenAPI are in place.
**Overall:** ready for demonstration. Every external integration runs in a clearly labelled demo or preview mode until the client supplies credentials.

## Feature status

Status key: ✅ = implemented and covered by automated tests; 🟡 = implemented, with a limitation noted; ⛔ = not done (depends on someone outside this task).

| Area | Feature | Status | Notes |
| --- | --- | --- | --- |
| Photography site | Home, photography, videography, portfolio + filters, project detail, packages, studio/locations, booking, about, FAQs, contact, booking status, privacy, terms, account | ✅ | The About page and legal pages are clearly marked templates |
| Podcast site | Home, studio overview, facilities (no invented specs), services, packages, locations, availability calendar, booking, gallery, FAQs, contact, booking status, account | ✅ | |
| Events site | Home, services, categories, packages, gallery, venues, enquiry form, consultation booking, enquiry status (accept/decline proposals), FAQs, contact, booking status, account | ✅ | Enquiries are never bookings |
| Infinity Studios site (BookMyShow-style) | One unified site for photography, video, podcast **and events**. BookMyShow layout and look (with the client's brand): header with search, city and sign-in; first-visit city pop-up; category strip; banner carousel; poster rails with rating strip; offers; category tiles; dark featured band. Service pages in movie-page layout. Showtimes-style picker (date strip + free times per studio). Booking-summary checkout with add-ons, coupon codes, convenience fee, discount and tax from the server quote. Payment countdown for the held slot. E-ticket with signed QR code. Ratings & reviews. Offers page. Plus listings with filters, search, quote briefs with attachments, receipts, account (saved services, preferences, reschedule), portfolio, policies | ✅ | Brand name is a placeholder, editable in admin. Equipment is generic and labelled *awaiting verification*. No reviews or testimonials are seeded; reviews come only from customers after their session. Sample coupons DEMO10 / PODCAST500 and the 2% convenience fee are labelled samples. |
| Offers, reviews & check-in | Coupons (percentage or flat, caps, minimum order, dates, total and per-customer limits, service restrictions, enforced under a lock); reviews (one per booking, only after the session, staff can hide with a reason but not edit); QR check-in (signed codes, time window, camera scanner in admin) | ✅ | |
| Design | Four distinct token-based themes, responsive layout, focus styles, reduced motion, skip links | ✅ | axe WCAG 2.1 AA scans run on 23 key pages, 12 of them on Infinity Studios |
| Imagery | 24 AI-generated sample images (Floot), lazy-loaded responsive WebP, committed to the repo | ✅ | Labelled as AI-generated sample imagery |
| Booking engine | Server-side date, duration and opening-hours validation; lead time and advance window; resource allocation; buffers; holds with expiry; status machine; history; reschedule | ✅ | |
| Conflict prevention | Advisory locks, in-transaction re-check and a PostgreSQL exclusion constraint | ✅ | Tested with 8 concurrent requests for one slot |
| Pricing | Fixed, hourly, packages, add-ons (fixed or per hour), discounts, configurable fees, tax and deposits, custom quotations, itemised breakdown | ✅ | All values are samples |
| Enquiries & quotations | Review, assign, follow-ups, versioned quotations, send, customer or staff response, expiry, conversion with availability check | ✅ | |
| Payments | Demo provider (simulated) + Razorpay adapter (orders, checkout signature, API re-fetch, signed webhooks, refunds), idempotency, real/simulated separation | 🟡 | **Verified against Razorpay in test mode** (25 Oct 2026, the client's test keys): order creation, the hosted checkout (netbanking test bank → *Success*), server-side payment verification, booking confirmation and a ₹1,000 partial refund processed by Razorpay. Test-mode payments are excluded from revenue. Webhooks are not configured (no webhook secret yet); a status check against Razorpay covers checkouts whose browser never returns. **Live keys have not been tested.** |
| Accounts | Register, sign in/out, profile, booking/enquiry/payment history, password reset | 🟡 | Reset and verification emails are previews only (no email provider). Email verification is not enforced. |
| Admin | Studio site (banners, browse categories, equipment, testimonials, policy pages), per-service studio settings (featured, categories, equipment, gallery, deposit %, preparation notes), reschedule-request queue, on-demand reminders, editable notification templates, enquiry attachments, popular services and today's room occupancy; plus dashboard (computed live), bookings, enquiries/quotations, customers, payments/refunds, services/packages/add-ons/categories, locations/resources/hours/blocks, content/FAQs/messages, configuration, integrations, notifications, audit log, staff roles | ✅ | |
| Notifications | Email/SMS/WhatsApp/push adapters with truthful statuses and a preview inbox; editable templates; staff alerts for new bookings and briefs; session reminders (idempotent, respect preferences) | 🟡 | No provider is configured. Bookings send email only. Reminders run from the admin button; schedule `POST /api/v1/admin/reminders/run` hourly in production. |
| Maps | Embed adapter | 🟡 | Not configured. Shows addresses only, and never a map for demo locations. |
| Security | See [SECURITY.md](SECURITY.md) | ✅ | Residual risks are listed there |
| Mobile app | | ⛔ | Out of scope for this task |

## Tests executed

All of these were run in this environment on 24–25 Oct 2026 against PostgreSQL 16.

| Suite | Result |
| --- | --- |
| `pnpm --filter @studio/core test` (Vitest, unit + DB integration) | **98 passed** (8 files) |
| `pnpm --filter @studio/api test` (Vitest, HTTP integration) | **24 passed** |
| `pnpm test:e2e` (Playwright on the **production builds**: 4 websites + admin + axe accessibility) | **47 passed** (31 Oct 2026, after the BookMyShow-style update). Covers the city pop-up, showtimes → checkout with coupon → simulated payment → e-ticket QR → receipt, offers, events, quote briefs, account features, admin offers/reviews/check-in. |
| `pnpm lint` (ESLint) | 0 errors, 0 warnings |
| `pnpm typecheck` | passed |
| `pnpm build` (API + 5 Next.js apps) | 6/6 successful |

These were **not** run: load or performance tests, cross-browser runs (Chromium only), real-device mobile testing, manual screen-reader testing, live Razorpay/Resend/Twilio/Maps calls (no credentials) and a penetration test.

## Known issues and limitations

- **Expired holds** are released lazily, when availability is read or a booking is created. Add a one-minute scheduled job in production.
- **Rate limiting** is per process. Use Redis when scaling horizontally. Server-side calls from the websites forward the visitor's IP; the API trusts that header only from configured proxies (`TRUST_PROXY`).
- **Brief attachments** are stored on the API server's local disk. Use a persistent disk or object storage in production; Render's free plan loses them on restart.
- **"Next free" slots** on cards are computed from live availability over the next 14 days and cached for 60 seconds.
- **Unknown category URLs** show the not-found page, but with HTTP status 200 because the page streams. Search engines are told not to index the demo.
- **Session reminders** must be triggered (admin button or a scheduled call); no scheduler is deployed.
- **Delivery callbacks** for email and SMS (`DELIVERED` status) are not wired yet.
- **Customer refunds** are initiated by staff. There is no automated refund rule, because the cancellation policy has not been provided.
- **Multiple currencies** are modelled but untested; everything is in INR.
- The **package tiers** on the events site (Essentials / Signature / Bespoke) are a sample structure without prices, since pricing is by quotation.
- **Demo bookings** in *awaiting payment* expire 30 minutes after seeding, as designed. Re-seed to restore them.
- **Changing the Prisma schema** auto-generates migrations that may try to drop the hand-written constraints (the exclusion constraint and partial unique indexes). Review each generated migration before applying it.

## External dependencies and information needed from the client

1. Final brand names (including the Infinity Studios platform name), logos, colours (if they differ), copy, social links and verified imagery.
2. The real service list, packages, prices, tax treatment (GST rate and HSN/SAC codes), deposit and cancellation/refund policy.
3. Addresses, opening hours, rooms/venues with capacities, verified equipment specifications, and any genuine client testimonials (with written permission).
4. Razorpay account (key ID/secret, webhook secret) and the settlement/refund policy.
5. Email provider and sender domain. SMS (DLT-registered sender) and WhatsApp Business templates, if wanted.
6. Google Maps API key, if maps are wanted.
7. A legally reviewed privacy policy and terms.
8. Hosting choice, domains and production database.
