# Kiwanja

Kiwanja is fantasy football for Ugandan football, built on its own live match data. It has two apps that share one backend and one database:

- **Fantasy app** (`/`): squads, transfers, captains, live points, leagues, head-to-head, cups and match centre.
- **Data Ops app** (`/ops`): fixtures, line-ups, live event logging by match analysts, two-analyst verification, corrections, publishing, scoring rules, audit and export.

> "Kiwanja" is a temporary working name. All clubs, players and matches in this build are **fictional sample data**. No real league, club or FPL branding is used.

---

## Run it in VS Code (Windows, macOS or Linux)

You need two things installed first:

1. **Node.js 20 or newer**: https://nodejs.org (the LTS version is fine).
2. **Docker Desktop**: https://www.docker.com/products/docker-desktop. Open it and wait until it says it is running. It runs the PostgreSQL database for you.

Then:

1. In VS Code choose **File → Open Folder…** and open this repository.
2. Press **Ctrl+Shift+B** (macOS: **Cmd+Shift+B**). This runs the task **"Kiwanja: Setup and run (first time)"**.
   You can also run `node scripts/setup.mjs` in the VS Code terminal, or double-click `setup.cmd` on Windows (`./setup.sh` on macOS/Linux).
3. When the terminal shows `Local: http://localhost:5173`, open http://localhost:5173.

The setup script does everything in order: checks Node, installs pnpm if it is missing, installs dependencies, creates `apps/api/.env`, starts PostgreSQL in Docker, creates the tables, loads the sample season, and starts both apps. It is safe to run again; it never wipes existing data unless you ask it to.

| What you want | How |
| --- | --- |
| Start the apps again later | Task **Kiwanja: Run apps**, or `pnpm dev` |
| Debug the API with breakpoints | Run and Debug panel → **Kiwanja: API + Web** |
| Wipe and reload the sample data | Task **Kiwanja: Reset database and sample data** |
| Run all tests | **Ctrl+Shift+P → Tasks: Run Test Task**, or `pnpm test` |

Already running PostgreSQL yourself? Put its address in `DATABASE_URL` in `apps/api/.env` and the Docker step is skipped.

### Demo accounts

Every account uses the password **`kiwanja123`**. The login page also has a one-click picker.

| Email | Role |
| --- | --- |
| `fan@kiwanja.test` | Fantasy manager with a team ("Demo Fan XI") |
| `admin@kiwanja.test` | Super admin |
| `competition@kiwanja.test` | Competition admin |
| `supervisor@kiwanja.test` | Match supervisor (resolves disputes, publishes) |
| `analyst.a@kiwanja.test` | Match analyst A (records events) |
| `analyst.b@kiwanja.test` | Match analyst B (verifies A's events) |
| `manager1…40@kiwanja.test` | 40 more fantasy managers so leagues look real |

The sample season has 16 fictional clubs, 288 players and 30 gameweeks. Gameweeks 1 and 2 are played and locked. Gameweek 3 is open, and both analysts are assigned to all of its matches.

---

## Try the live-goal demo (brief section 15)

Use two browser windows (one normal and one private) so you can be two people at once.

1. **Admin** (`admin@kiwanja.test`): Data Ops → Fixtures → open a Gameweek 3 match. The line-ups can be edited there and both analysts are already assigned.
2. **Analyst A** (`analyst.a@`): Live Matches → open the match → **Kick-off**. Gameweek 3 goes live and every fantasy line-up is frozen.
3. Tap **Goal**, pick the scorer, then pick the assister. The event shows *Pending*.
4. **Fan** window (`fan@`): My Team and Match Centre update within a second. The goal shows as provisional points.
5. **Analyst B** (`analyst.b@`): Verification → **Confirm**. Points become confirmed (✓) everywhere.
6. Analyst A cannot verify their own event; the server refuses it.
7. **Admin**: the event's history shows who recorded it, who verified it and every correction.

Repeat this with assist, yellow and red cards, substitutions, saves (every 3 saves = 1 point) and shots on target. Clean sheets appear at full time. To test a correction, Analyst B taps **Dispute** and the supervisor corrects the scorer: points move between players automatically. To test duplicate prevention, log the same goal twice: the console flags the second one as a possible duplicate and only saves it if the analyst chooses to.

The whole scenario runs automatically as a test: `apps/api/test/liveGoal.e2e.test.ts`.

---

## How it fits together

```
packages/core   Shared TypeScript: scoring engine, stat derivation, squad rules,
                auto-subs, H2H and cups, permissions, validation schemas.
                No database or UI, so the future mobile app can reuse it.
apps/api        Express + Prisma (PostgreSQL) + Socket.IO
apps/web        React + Vite + Tailwind + TanStack Query (both apps, split by route)
```

**Match events are kept separate from fantasy points.** Analysts write `match_events`, which are the source of truth. Everything after that is derived and can be rebuilt at any time:

```
match_events ──► player_match_statistics ──► fantasy_points ──► fantasy_gameweek_scores ──► team totals / leaderboards
 (analysts)        (provisional + confirmed)   (with a line-by-line explanation)
```

- **Provisional** points count pending events, so fans see a goal straight away. **Confirmed** points only count events a second analyst has verified.
- A correction, dispute or scoring-rule change recalculates the affected match and gameweek. Nothing is edited by hand.
- Every fantasy point has an explanation ("Goal (midfielder) ×1 = +5").
- Scoring rules, squad rules, formations, transfer costs and price changes are all editable in Data Ops → Fantasy Management. Experimental stats (shots on target, key passes, tackles and so on) can be switched on or off.

**Live collection** is built for a tablet at the stadium. Each event takes one or two taps. Events are saved to the device first (IndexedDB) and synced, each with its own ID, so a dropped connection never creates duplicates and device timestamps are kept. Near-identical events are flagged as possible duplicates. Edits use version numbers, so two devices cannot overwrite each other.

**Roles:** super admin, competition admin, match supervisor, match analyst and fantasy user. Every `/api/ops` route checks permissions on the server. Analysts can only log matches they are assigned to.

**Data origin:** clubs, players, fixtures and events carry an origin (`SAMPLE`, `MANUAL`, `IMPORTED`, `DEVICE` or `VIDEO`) and the app labels them. Data sources are listed in Data Ops → Settings with their attribution. Nothing is scraped, and no FUFA or league API is assumed to exist.

### Hardware and other machine data (future)

The software is ready to accept tracker or video-analytics data without changes to fantasy scoring. Create a data source in Data Ops → Settings, generate an API key, then:

```http
POST /api/ingest/metrics
x-api-key: <key>
Content-Type: application/json

{ "fixtureId": "…", "samples": [ { "playerId": "…", "metric": "DISTANCE_M", "value": 10342, "confidence": 0.9 } ] }
```

Metrics are stored per source in `player_metrics`, separate from analyst events.

---

## Commands

| Command | What it does |
| --- | --- |
| `pnpm setup` | Same as `node scripts/setup.mjs` |
| `pnpm dev` | API on :4000 and web on :5173, with hot reload |
| `pnpm test` | Unit tests (core and web) plus the API end-to-end tests. Needs the database running; it uses a separate `kiwanja_test` database |
| `pnpm typecheck` | TypeScript across all packages |
| `pnpm db:up` / `db:migrate` / `db:seed` / `db:reset` | Database helpers |

## Not built yet

- A native mobile app. The web app works on phones, and `packages/core` is ready to share with a React Native client.
- Email delivery for password resets. In development the reset link is shown on screen.
- Real club and player data. This needs agreements with data owners first.
- Tracker hardware. The ingest API above is ready for it.
