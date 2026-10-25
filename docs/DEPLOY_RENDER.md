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

**Already deployed the earlier version?** After merging, open the Blueprint in Render and choose **Sync** (or **Manual sync**). Render then creates the new `infinity-demo-studio` service and adds `SITE_URL_STUDIO` to the env group. Redeploy the API: it applies the new migrations, and because the existing demo database has no studio content, it reloads the full demo data set. Bookings made while testing the old demo are removed. It refuses to do this if the database holds any non-demo bookings, and logs a warning instead.

**Free plan notes:**
- Services sleep after 15 minutes idle; the first request takes about a minute. Open every link shortly before a meeting.
- The free database expires after 30 days.
- Files attached to quote briefs are stored on the API server's disk, which the free plan wipes on every restart or redeploy.
- If a website build fails with an out-of-memory error, switch that service to the Starter plan.

**Reset the demo data:** open the database in Render and choose **Delete database**. Re-apply the Blueprint (or create a new database with the same name), then redeploy the API.
