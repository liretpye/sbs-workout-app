# SBS Linear Progression — Workout App

A web app version of the Stronger By Science Linear Progression spreadsheet. The frontend is a static React app you host for free on GitHub Pages; your workout data lives in a free Supabase database, so it syncs between your phone and laptop.

The progression math is a faithful port of the spreadsheet: each week's training max is computed from last week's completed sets and last-set RIR (or a single @8 you enter), work-set weight is `TM × intensity` rounded to your rounding increment, and reps per set / RIR targets are looked up by intensity — exactly like the sheet. The engine is verified against 546 lift-weeks of the original spreadsheet's own computed values (`node tests/engine.test.mjs`).

Your setup values (maxes, single @8 percentages, progression table) and your logged history from the 3x and 5x tabs are included in `supabase/seed.sql`, so the app picks up exactly where the spreadsheet left off.

## Setup (one time, ~10 minutes)

### 1. Create the Supabase database

1. Go to [supabase.com](https://supabase.com), sign up (free), and create a new project. Any name/region is fine; set a database password (you won't need it again for this app).
2. In the project, open **SQL Editor**.
3. Paste the contents of `supabase/schema.sql`, run it.
4. Paste the contents of `supabase/seed.sql`, run it. This loads your lifts, maxes, program settings, and workout history from the spreadsheet.
5. Go to **Project Settings → API** and note two values: the **Project URL** (`https://xxxx.supabase.co`) and the **anon public** API key.

### 2. Deploy to GitHub Pages

1. Create a new GitHub repository and push this folder to it (branch `main`).
2. In the repo: **Settings → Pages → Source → GitHub Actions**.
3. The included workflow (`.github/workflows/deploy.yml`) builds and deploys automatically on every push. After the first run finishes, your app is at `https://<username>.github.io/<repo>/`.

### 3. Connect

Open the app. It asks for the Supabase Project URL and anon key from step 1 — paste them and hit Connect. They're stored in that browser's local storage only, so do this once per device (phone, laptop, etc.). All workout data goes to Supabase, not the browser.

> **Security note:** the anon key plus permissive database policies means anyone who has both your project URL and anon key can read/write your workout data. Don't commit them to the repo or post them anywhere. For a personal training log this is generally an acceptable trade-off; if you ever want it locked down harder, Supabase auth can be added later.

## Using the app

**Workout tab** — pick the week and day. Each lift card shows the prescribed weight, sets × reps, last-set RIR target, and a suggested single @8. Enter **sets completed** and **RIR on last set**, hit Save, and the card shows a live preview of next week's training max. If you worked up to a single @8, enter the weight — it recalibrates that week's TM just like typing it in the sheet's `single @8` column. Notes and a video link are optional.

**Additional workouts** — below the main lifts, log anything extra (exercise, weight, reps, sets, RIR, notes). Entries from previous weeks show up as one-tap "Do again" suggestions, mirroring the sheet's accessory carry-forward.

**Setup tab** — everything from the sheet's Quick Setup: days per week (3x–6x layouts, all included), current week, rounding, units; per-lift maxes, single @8 %, set goal, and intensity; the weekly TM adjustment table; and rep / RIR targets by intensity.

## Progression rules (as in the sheet)

Given set goal `S` and last-set RIR target `R`, next week's TM multiplier is chosen by this week's result:

| Result | Default adjustment |
|---|---|
| 2+ sets short of goal | −5% |
| 1 set short, or last set below RIR target | −2% |
| Hit set goal at RIR target | 0% |
| 1 RIR above target | +1% |
| 2 RIR above target | +3% |
| 3+ RIR above target | +5% |

A week with no logged sets leaves the TM unchanged. All values are editable in Setup.

## Local development

```bash
npm install
npm run dev        # local dev server
npm run build      # production build to dist/
node tests/engine.test.mjs   # verify progression math against the original sheet
```

## Structure

```
src/lib/engine.js     progression math (pure functions, mirrors the sheet formulas)
src/lib/program.js    glue between DB rows and the engine
src/lib/supabase.js   Supabase client + connection config (browser localStorage)
src/lib/store.js      data access (load/save)
src/pages/            Workout, Setup, Connect
supabase/schema.sql   database tables + policies
supabase/seed.sql     your program config + imported history (generated from the xlsx)
tests/                engine verification against the original spreadsheet values
```
