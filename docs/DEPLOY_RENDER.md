# One-click demo on Render

`render.yaml` creates everything on Render's free plan: PostgreSQL, the API, the three websites and the admin panel.

1. Merge this branch into `main` on GitHub.
2. On render.com, sign in with GitHub, then **New + → Blueprint**. Select the `Client-demo-` repository, then **Apply**.
3. Wait until all five services show **Live** (10–20 minutes). The API applies migrations and loads the demo data automatically, but only into an empty database.

| Link | |
| --- | --- |
| https://infinity-demo-photo.onrender.com | Photography & videography |
| https://infinity-demo-podcast.onrender.com | Podcast studio |
| https://infinity-demo-events.onrender.com | Event management |
| https://infinity-demo-admin.onrender.com | Admin (`admin@demo.example` / `DemoAdmin!2026`) |

**If a name was taken,** Render adds a suffix to that service's URL. Copy the real URLs into **Env Groups → infinity-demo-urls**, then redeploy all five services (**Manual Deploy → Deploy latest commit**).

**Free plan notes:**
- Services sleep after 15 minutes idle; the first request takes about a minute. Open every link shortly before a meeting.
- The free database expires after 30 days.
- If a website build fails with an out-of-memory error, switch that service to the Starter plan.

**Reset the demo data:** open the database in Render and choose **Delete database**. Re-apply the Blueprint (or create a new database with the same name), then redeploy the API.
