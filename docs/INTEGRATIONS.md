# Integration status report

States are computed by the API from server configuration and recorded live checks. The admin panel shows them under **Integrations**. An integration reaches *Connected and verified* only after a successful live credential check against the provider, and changing the credentials resets it to *Configured, not verified*. A failing integration is never silently replaced with a simulated success.

| Integration | State in this delivery | Credentials required | Behaviour until configured |
| --- | --- | --- | --- |
| Razorpay payments | **Test mode verified locally (25 Oct 2026)** with the client's `rzp_test_` keys: order creation, checkout, server-side verification, booking confirmation, refund. Not configured on Render until the keys are added there (see [DEPLOY_RENDER.md](DEPLOY_RENDER.md)). | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`. Set the dashboard webhook to `/api/v1/webhooks/razorpay` with the events `payment.captured`, `payment.failed`, `order.paid`, `refund.processed`, `refund.failed`. | `PAYMENTS_MODE=demo`: a clearly labelled simulated checkout. No card data is collected and no money moves; transactions are flagged `isSimulated` and excluded from revenue. |
| Email (Resend) | **Not configured** | `RESEND_API_KEY`, `EMAIL_FROM` (verified sender domain) | Messages are stored as *Preview only* in Admin → Notifications |
| SMS (Twilio) | **Not configured** | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_SMS_FROM` (Indian DLT registration required) | Preview only. Booking flows currently send email only; SMS templates are ready for the approved channel. |
| WhatsApp (Twilio) | **Not configured** | the Twilio credentials above, plus `TWILIO_WHATSAPP_FROM` and approved WhatsApp templates | Preview only. Customers can opt in (with recorded consent) on the Infinity Studios account page; the page states that WhatsApp delivery is not connected yet. |
| Push notifications | **Not configured** | Provider to be chosen with the mobile app (e.g. FCM) | The adapter reports *not configured* |
| Google Maps embed | **Not configured** | `GOOGLE_MAPS_EMBED_API_KEY` (referrer-restricted) | Location pages show the stored address only. No map, directions, distances or travel times. Demo locations never show a map. |
| Email verification / password reset delivery | **Simulation** | Same as Email | Links appear in the notification preview inbox (development only) |
| File storage (brief attachments) | **Local disk** | Optional `UPLOAD_DIR`. For production, a persistent disk or object storage. | Files are stored under `storage/uploads` on the API server. On Render's free plan this disk is **not persistent**, so attachments are lost on restart or redeploy. |
| Sample imagery (Floot) | **Downloaded and committed** (24 images, WebP 640/1024 px) | Run `pnpm images:fetch` again only to refresh them | Labelled placeholders appear for any missing image |

**Razorpay test mode.** With `PAYMENTS_MODE=live` and a key starting `rzp_test_`, customers see a *Razorpay test mode* notice with test card details. Payments go through Razorpay's real checkout, but they are flagged as not real money and excluded from revenue, and refunds go through Razorpay's test API. Without `RAZORPAY_WEBHOOK_SECRET`:
- payments are confirmed from the checkout callback; the booking page re-checks open orders with Razorpay, so a customer whose browser never returned is still recorded;
- pending refunds are completed when the admin Payments page checks them with Razorpay.

Add the webhook (and its secret) before going live.

Delivery status semantics: `PREVIEW_ONLY` means not sent. `ACCEPTED` means the provider accepted the message, which is **not** proof of delivery. `DELIVERED` is set only by a provider delivery callback (not yet wired). `FAILED` records the provider's error.

## Verifying an integration

1. Add the variables to the API's environment and restart it.
2. Admin → Integrations → **Verify now**. This calls the provider's authenticated API (Razorpay `GET /v1/orders`, Resend `GET /domains`, Twilio `GET /Accounts/{sid}`).
3. For Razorpay, also complete a real test-mode payment end to end. The webhook must arrive and be verified before the booking shows as confirmed.
