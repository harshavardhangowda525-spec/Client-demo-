# Testing

| Suite | Command | What it covers |
| --- | --- | --- |
| Core unit + integration | `pnpm --filter @studio/core test` | Pricing engine, date and timezone validation, availability engine, status machine, permissions, references and tokens, booking creation, overlap prevention (including 8 simultaneous requests for one slot), the database exclusion constraint, hold expiry, rescheduling, customer data isolation, demo payments, idempotency, amount mismatch, refunds, Razorpay signature and webhook handling, enquiries, the quotation workflow and conversion |
| API integration | `pnpm --filter @studio/api test` | HTTP-level authorisation for every role, CSRF origin checks, validation error shape, guest token access, sign-up cannot assign roles, session revocation, simulated checkout, webhook signatures, OpenAPI document |
| End-to-end | `pnpm test:e2e` | Browser journeys on all three websites and the admin panel, plus automated WCAG 2.1 A/AA scans (axe-core) and a keyboard check |
| Static checks | `pnpm lint`, `pnpm typecheck`, `pnpm build` | ESLint, TypeScript across all packages, production builds |

`pnpm test` runs the core and API suites.

## Databases used by tests

Core and API tests run against `TEST_DATABASE_URL`, never the demo database. The suites apply migrations and then re-seed that database. Test files run one at a time because they share it.

End-to-end tests drive the **running** applications. Start the stack first (`pnpm dev`, or `pnpm build && pnpm start`) and seed the demo database. The tests create real records in that database; run `pnpm --filter @studio/core seed -- --force` to reset it afterwards.

```bash
pnpm --filter @studio/core seed -- --force
pnpm build && pnpm start      # in another terminal
pnpm test:e2e
```

The auth endpoints are rate limited (8 sign-ins per minute per IP). The admin e2e spec reuses sessions so that repeated runs don't trip the limit.

## Results recorded for this delivery

See [PROJECT_STATUS.md](PROJECT_STATUS.md#tests-executed) for the exact suites and counts that were run.
