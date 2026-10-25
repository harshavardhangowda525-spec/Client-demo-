# Local setup

## 1. Prerequisites

- **Node.js 22**. The version is pinned in `.nvmrc`.
- **pnpm 10**. Run `corepack enable` once if pnpm isn't installed.
- **PostgreSQL 14 or newer.** The database role used for migrations must be able to run `CREATE EXTENSION btree_gist`, so use a superuser or the database owner on managed providers that allow it.
- **Optional:** Chromium for end-to-end tests. Install it with `npx playwright install chromium` if it isn't already present.

## 2. Database

```bash
createuser -s demo && psql -c "ALTER ROLE demo PASSWORD 'demo'"   # or use your own credentials
createdb -O demo studio_demo
createdb -O demo studio_test        # used only by automated tests
```

## 3. Configure

```bash
cp .env.example .env
# Required: set BETTER_AUTH_SECRET to a random value of 32+ characters
openssl rand -hex 32
```

The defaults run every integration in demo or preview mode. See [INTEGRATIONS.md](INTEGRATIONS.md).

## 4. Install, migrate and seed

```bash
pnpm install          # also generates the Prisma client
pnpm db:migrate       # applies packages/db/prisma/migrations
pnpm db:seed          # resettable demo data + demo accounts
pnpm images:fetch     # optional: downloads the sample imagery (needs network access to Floot)
```

`pnpm db:seed` wipes all application tables. It refuses to run when `NODE_ENV=production` (unless `ALLOW_DEMO_SEED=true` is set) or when non-demo bookings exist; to override the second guard, run `pnpm --filter @studio/core seed -- --force`.

Some demo bookings are created in the "awaiting payment" state with a 30-minute payment hold. As in production, they are released automatically when the hold expires. Re-run the seed to restore them.

## 5. Run

```bash
pnpm dev     # development: API (watch mode) + 4 websites + admin
# or
pnpm build && pnpm start   # production builds
```

| URL | |
| --- | --- |
| http://localhost:3001 | Photography & videography |
| http://localhost:3002 | Podcast studio |
| http://localhost:3003 | Event management |
| http://localhost:3004 | Infinity Studios: discovery & booking platform |
| http://localhost:3100 | Admin panel |
| http://localhost:4000/api/health | API health |
| http://localhost:4000/api/openapi.json | Live OpenAPI document |

Each website proxies `/api/*` and `/media/*` to the API, so sign-in cookies stay first-party. In local development all sites share the `localhost` cookie jar, so one sign-in works across every site.

## 6. Demonstration script

**Infinity Studios (http://localhost:3004)**

1. Pick a city in the header, type *podcast* in the search box and open a suggestion.
2. On a service page, choose a package and a free slot in the booking panel. The price is calculated on the server. **Continue to book**, enter your details, reserve, then simulate the deposit payment and open the receipt.
3. Open *Brand & advertising shoots* → **Request a quote**. Attach a PDF or image and send the brief; it becomes an enquiry, not a booking.
4. Sign in as the demo customer and save a service (♡). Set notification preferences, and from a booking at least 48 hours away, request a new time.
5. In admin, decide the request under *Reschedule requests*, download the brief's attachment under *Enquiries & briefs*, and edit banners, categories, equipment, testimonials and policy pages under *Studio site*.

**The three brand sites**

1. **Photography site → Book a session.** Choose *Product photography* and watch the server-side price breakdown update. Pick a date and time, enter your details and reserve the slot.
2. On the booking status page, choose **Pay deposit → Simulate successful payment**. The status changes to *Confirmed*, and the payment is labelled *Simulated*.
3. **Podcast site → Availability.** Pick a slot and book it. Opening the same slot again shows it is no longer offered.
4. **Events site → Plan an event.** Submit an enquiry, and note that it is explicitly not a booking.
5. **Admin (admin@demo.example):**
   - Open the new enquiry and prepare a quotation.
   - Send it, then record acceptance.
   - Convert it into a booking; the venue's availability is checked first.
   - Approve the corporate-video request under *Bookings*.
   - Check the *Audit log* and *Notifications*. Emails appear as previews because no provider is configured.
