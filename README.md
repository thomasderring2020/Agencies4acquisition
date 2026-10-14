# M&A Target Tracker

A private, password-protected tracker for prospective agency acquisitions. It reads the weekly **Living M&A Target Tracker** Google Sheet, and the team keeps status, contacts, notes and LinkedIn links on top of it.

- **List view**: every target with priority, revenue, feasibility, market tier and research call. Sort any column, filter from the sidebar, and change status right in the row.
- **Detail panel**: click a row (or a map pin). Status, website and LinkedIn are at the top, then financials, the investment thesis (next step, fit, risk), contacts, outreach and notes.
- **Map view**: every target on a US map, colored by status and sized by revenue. Region buttons zoom in and list exactly that region's targets. Free pan/zoom lists whatever is on screen.
- **Updates**: a weekly automatic sync from the sheet, plus **Sync now** and **CSV upload** buttons for manual pushes.

Team data (status, contacts, notes, links) is stored separately from the sheet data. A sync never overwrites it.

---

## One-time setup (about 20 minutes)

You'll need a GitHub account, a Vercel account, and edit access to the Google Sheet.

### 1. Get a CSV link for the sheet

In Google Sheets: **File → Share → Publish to web** → choose the **Target Tracker** tab → choose **Comma-separated values (.csv)** → **Publish**, then copy the link.

> Anyone who has this link can read the sheet, so treat it like a password. If you'd rather not publish, you can instead set **Share → General access → Anyone with the link (Viewer)** and use the normal sheet URL (including the `#gid=` part). The app converts either kind of link.

### 2. Put the code on GitHub

1. Create a **private** repository on GitHub, e.g. `mna-target-tracker`.
2. Unzip this folder and push it from VS Code (*Source Control → Publish to GitHub*), or drag the unzipped files into the repo using GitHub's **Add file → Upload files**.

### 3. Deploy on Vercel

1. In Vercel: **Add New → Project →** import the GitHub repo. It detects Next.js automatically.
2. Before clicking Deploy, open **Environment Variables** and add:

| Name | Value |
|---|---|
| `TEAM_PASSWORD` | The password your team will use to get in |
| `SHEET_CSV_URL` | The link from step 1 |
| `CRON_SECRET` | Any long random string (e.g. from a password generator). It stops anyone else from triggering the sync. |

3. Click **Deploy**.

### 4. Add the database (required for saving)

1. In the Vercel project: **Storage → Create Database → Upstash for Redis** (from the Marketplace) → free plan → **Create**. Connect it to this project for all environments.
2. Vercel adds `KV_REST_API_URL` and `KV_REST_API_TOKEN` for you.
3. **Deployments → ⋯ → Redeploy** so the app picks them up.

Without this step the app shows a red "Database not connected" banner and nothing you enter will be saved.

### 5. First run

Open your Vercel URL, enter the team password, and type your name when prompted. The first visit pulls the sheet automatically, and after that you can press **Sync now** any time.

Share the URL and password with the team. Each person enters their name once, so every contact, note and status change shows who made it.

---

## How updates work

| | |
|---|---|
| **Automatic** | Every **Monday at 1:00 pm Central** (18:00 UTC) Vercel runs the sync. To change it, edit the `schedule` in `vercel.json` ([cron syntax](https://crontab.guru)) and push. |
| **Sync now** | Pulls the sheet right away. |
| **CSV button** | Upload a CSV export (File → Download → CSV). Use this if the link is ever broken or you want to push a one-off file. |

What a sync does:

- **New agencies** are added, flagged **New** in the list, and placed on the map.
- **Existing agencies** get the latest sheet values (revenue, rank, notes from research, and so on).
- **Agencies removed from the sheet** stay in the tracker with their contacts and notes, but are hidden. Turn them on with *Layers → Show dropped from sheet*.
- **Team status, contacts, notes and links are never touched.**

### Sheet rules of thumb

- The note rows above the header are fine. The app finds the header row by its **Agency** column, and reads the "Updated …" and "Screen: …" lines. The excluded states listed under *Hard geographic exclusions* are hatched on the map and tagged in the list.
- **The agency name is the unique key.** If you rename an agency in the sheet, the app treats it as a new agency. The old entry keeps its contacts and notes, and shows up under *Show dropped from sheet*.
- The sheet's own **Status** column (New / Watch / Pass) is the researcher's call, and it appears as the *Research call* tag. The team pipeline status (New → Researching → Working → Passed to M&A / Lost) is separate. It is set in the app and starts at **New**.
- **Optional columns the app understands** if you add them later: `Address` (maps to the street via the free US Census geocoder), `LinkedIn` (fills the agency's LinkedIn button), and `Latitude` / `Longitude`. Any other new column appears automatically under *Basis & sources* in the detail panel.
- Mapping without an address uses the first city in the **HQ** column (e.g. "Dallas / Fort Worth, TX" → Dallas). If the city can't be found it falls back to the state's center, and the sync message tells you which agencies that happened to.

---

## Good to know

- **Vercel plan**: the free Hobby plan is for non-commercial use. A company tool should be on **Pro** (about $20/month per member). Upstash's free tier is plenty for this.
- **Changing the password**: update `TEAM_PASSWORD` in Vercel and redeploy. This signs everyone out.
- **Search engines**: every page is marked `noindex`, and nothing is visible without the password.
- **Sharing a target**: open an agency and click **Copy link**. The link opens straight to that agency.
- **Backups**: the data lives in Upstash Redis under keys starting with `mna:`, and the Upstash console can browse and export it.

## Running it locally (optional)

```bash
npm install
npm run dev        # http://localhost:3000, no password needed locally
```

Without Upstash variables, local data is saved to `.data/db.json`. Copy `.env.example` to `.env.local` to try the sheet sync or the password locally.

## Project map

```
app/
  page.tsx                     → the app (list + map + panel)
  login/page.tsx               → password screen
  api/agencies/…               → read agencies; save status, links, contacts, notes
  api/sync/route.ts            → weekly cron (GET) and Sync now / CSV upload (POST)
components/                    → ListView, MapView, DetailPanel, Sidebar, StatusPill
lib/parse.ts                   → reads the sheet (header detection, column matching, HQ parsing)
lib/geocode.ts                 → address → Census geocoder; city → built-in US city table
lib/store.ts                   → Upstash Redis (or local file) storage
middleware.ts                  → team-password gate
vercel.json                    → weekly sync schedule
```

City coordinates come from [GeoNames](https://www.geonames.org/) (CC BY 4.0), and state shapes from [us-atlas](https://github.com/topojson/us-atlas) (US Census Bureau).
