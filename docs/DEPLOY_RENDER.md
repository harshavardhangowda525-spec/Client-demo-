# One-click demo on Render

`render.yaml` creates everything on Render's free plan: PostgreSQL, the API, the four websites (including Infinity Studios) and the admin panel.

1. Merge this branch into `main` on GitHub.
2. On render.com, sign in with GitHub, then **New + → Blueprint**. Select the `Client-demo-` repository, then **Apply**.
3. Wait until all six services show **Live** (10–20 minutes). The API applies migrations and loads the demo data automatically, but only into an empty database.

| Link | |
| --- | --- |
| https://infinity-demo-studio.onrender.com | **Infinity Studios** discovery & booking platform |
| https://infinity-demo-photo.onrender.com | Photography & videography |
| https://infinity-demo-podcast.onrender.com | Podcast studio |
| https://infinity-demo-events.onrender.com | Event management |
| https://infinity-demo-admin.onrender.com | Admin (`admin@demo.example` / `DemoAdmin!2026`) |

**If a name was taken,** Render adds a suffix to that service's URL. Copy the real URLs into **Env Groups → infinity-demo-urls**, then redeploy all six services (**Manual Deploy → Deploy latest commit**).

**Already deployed the earlier version?** After merging, open the Blueprint in Render and choose **Sync**. Render creates the new `infinity-demo-studio` service and adds `SITE_URL_STUDIO` to the env group. When the API restarts, it adds any missing studio content (categories, banners, equipment, policy pages, FAQs and the new services). Existing bookings, customers and content are never changed or removed.

**Razorpay test payments:** `render.yaml` sets `PAYMENTS_MODE=live` on the API and declares `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` without values, so the keys never go into the repository.
1. Click **Dashboard** → **infinity-demo-api** → **Environment** (left menu).
2. Check `PAYMENTS_MODE` is `live`. Set `RAZORPAY_KEY_ID` (the `rzp_test_…` key) and `RAZORPAY_KEY_SECRET`. If either key is missing, click **Add Environment Variable**.
3. Click **Save, rebuild, and deploy**.
4. Check `https://infinity-demo-api.onrender.com/api/v1/sites/PHOTO`. It should show `"paymentsMode":"live"` and `"paymentsTestMode":true`.
5. Open a booking and click **Pay deposit**. Razorpay's checkout opens with a *Test Mode* ribbon.

Values set in the dashboard for keys that `render.yaml` defines with a value (such as `PAYMENTS_MODE`) are reset on the next Blueprint sync. To use the simulated checkout permanently, change `PAYMENTS_MODE` to `demo` in `render.yaml`. Without Razorpay keys, `live` turns online payment off, and customers are told the team will arrange payment.

**Free plan notes:**
- Services sleep after 15 minutes idle; the first request takes about a minute. Open every link shortly before a meeting.
- The free database expires after 30 days.
- Files attached to quote briefs are stored on the API server's disk, which the free plan wipes on every restart or redeploy.
- If a website build fails with an out-of-memory error, switch that service to the Starter plan.

**Reset the demo data:** open the database in Render and choose **Delete database**. Re-apply the Blueprint (or create a new database with the same name), then redeploy the API.
