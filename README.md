# Studio Platform: client demonstration

A working demonstration built by **Infinity Web & Apps**. It runs three independently branded websites on one shared backend:

| App | What it is | Port |
| --- | --- | --- |
| `apps/web-photo` | **Lumen Studio**: photography & videography | 3001 |
| `apps/web-podcast` | **Signal Room**: podcast studio discovery & booking | 3002 |
| `apps/web-events` | **Atelier Events**: event services, enquiries & quotations | 3003 |
| `apps/admin` | Central administration panel | 3100 |
| `apps/api` | Shared REST API (Fastify) for all sites, the admin panel and the future mobile app | 4000 |

All four front ends share one PostgreSQL database and one set of business rules: the booking engine, availability engine and pricing engine in `packages/core`.

> **Everything is demonstration content.** That includes brand names, services, prices, tax rate, deposit and cancellation policy, locations, opening hours and the AI-generated imagery. Payments run in a clearly labelled **simulation mode**, and no money is taken. See [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md) for what is real and what is simulated.

## Quick start

Requirements: Node.js 22, pnpm 10 and PostgreSQL 14 or newer.

```bash
pnpm install
cp .env.example .env               # then set BETTER_AUTH_SECRET (openssl rand -hex 32) and DATABASE_URL
pnpm db:migrate                    # apply migrations
pnpm db:seed                       # load demo data (wipes the database; refuses if real bookings exist)
pnpm dev                           # API + three websites + admin
```

Then open http://localhost:3001, http://localhost:3002, http://localhost:3003 and http://localhost:3100.

### Demo accounts (demo database only)

| Role | Email | Password |
| --- | --- | --- |
| Administrator | `admin@demo.example` | `DemoAdmin!2026` |
| Manager | `manager@demo.example` | `DemoManager!2026` |
| Staff | `staff@demo.example` | `DemoStaff!2026` |
| Customer | `customer@demo.example` | `DemoCustomer!2026` |

### Sample imagery

The images were generated with Floot and are listed in `assets/demo-images/catalog.json`. Download them with:

```bash
pnpm images:fetch      # writes responsive WebP files + manifest to assets/demo-images/generated/
```

Until the images are downloaded, every image slot shows a labelled, art-directed placeholder.

## Documentation

- [Local setup](docs/SETUP.md)
- [API documentation](docs/API.md) and the generated [OpenAPI document](docs/openapi.json)
- [Testing](docs/TESTING.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Security notes](docs/SECURITY.md)
- [Integration status](docs/INTEGRATIONS.md)
- [Project status, known limitations and test record](docs/PROJECT_STATUS.md)
- [Production launch checklist](docs/LAUNCH_CHECKLIST.md)

## Repository layout

```
apps/
  api/            Fastify API, Better Auth, route registry → OpenAPI
  web-photo/      Next.js 16 website (Lumen Studio)
  web-podcast/    Next.js 16 website (Signal Room)
  web-events/     Next.js 16 website (Atelier Events)
  admin/          Next.js 16 admin panel
packages/
  db/             Prisma schema + versioned SQL migrations
  core/           Domain services: pricing, availability, booking, enquiries,
                  quotations, payments, notifications, integrations, audit, seed
  ui/             Design tokens, shared components, booking flow, shared pages
assets/demo-images/   Sample image catalogue (Floot) + downloaded variants
e2e/              Playwright end-to-end and accessibility tests
scripts/          Image fetch script
docs/             Documentation
```
