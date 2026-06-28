# CLAUDE.md

Guidance for AI coding agents (and humans) working in the **TableBooker** repo. Read this first,
then the deeper docs it points to.

## What this is

TableBooker is a restaurant-reservation platform built as an **npm-workspaces monorepo**: three
independent React frontends over **one** NestJS + Prisma + PostgreSQL API. Everything reads/writes
the same database, so a reservation or blocked period created in the staff portal is immediately
visible (and blocking) in the customer booking flow.

## Companion docs (don't duplicate them — read them)

- **`README.md`** — quick start, demo logins, prerequisites.
- **`HANDOFF.md`** — the single most important doc for current state: the reservation scheduler
  rework, status lifecycle, drag/resize/pan internals, undo/redo, blocked-periods & resource-mode
  features, the `setTables` reconcile fix, and the live gotchas. **Check it before touching the
  portal scheduler, floor plan, or anything Prisma-migration related.**
- **`PROJECT_DESCRIPTION.md`** — architecture narrative + per-person ownership.

## Architecture

| Workspace        | Stack                                   | Dev port | Role |
|------------------|-----------------------------------------|----------|------|
| `server`         | NestJS 11 + Prisma 6 + PostgreSQL       | `4000` (prefix `/api`) | Shared REST API, auth, business logic |
| `apps/customer`  | React 19 + Vite + **plain JS/JSX** + Tailwind 4 | `5173` | Diners — discover & book |
| `apps/portal`    | React 19 + Vite + **TypeScript** + Tailwind 4   | `5174` | Restaurant staff — scheduler, floor plan, blocks, setup |
| `apps/admin`     | React 19 + Vite + **TypeScript** + Tailwind 4   | `5175` | Platform admins — approve/disable restaurants, reset passwords, stats |
| `shared`         | plain JS/TS                             | —        | The single floor-plan renderer + seed dataset; imported by server and frontends |

- **DB**: PostgreSQL 16 in Docker (`docker-compose.yml`), host port **5433** (`postgres/postgres`, db `tablebooker`).
- **Auth**: real JWT + bcrypt + Nest guards (`StaffGuard` / `AdminGuard` + restaurant-ownership checks).
- Ports are hardcoded with `--strictPort` in each app's `dev` script — startup fails if the port is taken.

## Repository layout

```
server/          NestJS API
  src/
    auth/        JWT login (staff + admin), guards, CurrentUser decorator
    restaurants/ public discovery + staff CRUD (zones, tables, floorplan, images, menu)
    reservations/ booking + staff lifecycle + ReservationEvent audit log
    availability/ slot engine: opening hours ∩ reservations ∩ blocked periods
    blocked/     blocked periods (single + recurring)
    admin/       restaurant approval, staff/password mgmt, stats
    dashboard/   staff daily summary
    recurrence/  WEEKLY/MONTHLY rule expansion (used by availability + blocked)
    upload/      multer image upload to ./uploads
    common/serializers.ts  Prisma row -> JSON (public vs full shapes)
    main.ts      global prefix /api, CORS allowlist, ValidationPipe
  prisma/        schema.prisma + migrations/ + seed.ts
apps/customer/   pages/, components/, context/, api/client.js
apps/portal/     pages/, components/, context/, api/client.ts, types/index.ts, lib/
apps/admin/      pages/, components/, context/, api/client.ts
shared/          floorplan/ (FloorPlanCanvas.jsx, constants.js) + seed-data.ts
```

## Commands

All commands run from the repo root unless noted. Shell is **PowerShell on Windows** (see Gotchas).

```bash
# First-time setup
npm install
npm run db:up                                              # Postgres in Docker on :5433
cp server/.env.example server/.env                         # if missing
npm --workspace=@tablebooker/server run prisma:migrate     # apply schema
npm --workspace=@tablebooker/server run seed               # 12 Tbilisi restaurants + demo data

# Run
npm run dev            # server + all 3 frontends concurrently
npm run dev:server     # NestJS watch (:4000)   — also dev:customer / dev:portal / dev:admin

# Build / verify
npm run build          # builds server + all 3 frontends
# portal & admin `build` run `tsc -b` first, so a type error fails the build.
# To typecheck only: `npx tsc -b` inside apps/portal or apps/admin.
npm --workspace=@tablebooker/customer run lint   # customer has an ESLint flat config; portal/admin lean on tsc

# Database (run from server workspace)
npm --workspace=@tablebooker/server run prisma:generate   # after schema.prisma changes
npm --workspace=@tablebooker/server run seed              # idempotent reseed
npm --workspace=@tablebooker/server run db:reset          # DESTRUCTIVE: drop + migrate + seed
```

**Demo logins**: admin `admin@tablebooker.ge` / `admin`; staff `owner@shavilomi.ge` / `password`
(fully configured); `owner@demobistro.ge` / `password` (first-login setup wizard). SMS verification
accepts any 6 digits. See `README.md`.

## Data model (Prisma — `server/prisma/schema.prisma`)

Models: **Restaurant**, RestaurantImage, MenuItem, Zone, **Table**, FloorPlanElement, **Staff**,
Admin, **Reservation**, ReservationEvent, **BlockedPeriod**, Notification.

Key enums:
- `RestaurantStatus`: PENDING → APPROVED / DISABLED (public list shows APPROVED **and** `published`).
- `ReservationStatus`: PENDING → CONFIRMED → SEATED → COMPLETED, plus CANCELLED. **`NO_SHOW` was
  removed** — model a no-show as CANCELLED (kept visible, not archived). Don't reintroduce it.
- `ReservationSource` (CUSTOMER/STAFF/ADMIN — who created it, immutable) vs `ReservationChannel`
  (ONLINE/PHONE/WALK_IN — how it arrived, staff-editable).
- `TableShape` (CIRCLE/SQUARE/RECT), `BlockScope` (TABLES/ZONE), `BlockType` (SINGLE/RECURRING).

Conventions baked into the schema:
- **Soft delete everywhere**: `isArchived` + `deletedAt`. Reads must filter archived rows manually —
  it is not automatic.
- **Dates/times are strings**: dates `YYYY-MM-DD`, times `HH:mm`.
- **JSON config blobs** on Restaurant: `openingHours`, `reservationRules`, `capacityRules`,
  `reservationConfirmationPolicy`, `holidayClosures`. Resource-mode config also lives inside
  `reservationRules` (`resourceMode`, `resourceMeta`) — no dedicated columns.
- Migrations live in `server/prisma/migrations/`. Per `HANDOFF.md` §3.1, the
  `20260617010000_remove_google_import` migration may be **created but not yet applied** — verify with
  `npx prisma migrate status` before assuming the DB matches `schema.prisma`.

## Where things live (per area)

**Backend** — endpoint groups (read the controllers for exact routes; all under `/api`):
`auth/` (`POST /auth/login`, `POST /admin/login`, `GET /auth/me`), `restaurants/` (public `GET`,
staff `PUT` for zones/tables/floorplan/images/menu), `reservations/` (`POST` public booking, staff
`GET`/`POST /manual`/`PATCH`/`DELETE`), `availability/` (`GET /restaurants/:id/availability?date=`),
`blocked/`, `dashboard/`, `admin/`, `upload/`. Serialization for all of these is centralized in
`server/src/common/serializers.ts`.

**Customer (`apps/customer`)** — `src/App.jsx` (routes), `src/api/client.js`, two contexts:
`RestaurantsContext.jsx` (one-shot list fetch shared across pages) and `ReservationContext.jsx`
(the multi-step booking state + localStorage history). `pages/RestaurantPage.jsx` is the booking
flow; `pages/HomePage.jsx` / `pages/RestaurantsPage.jsx` are the discovery + client-side filter UI.

**Portal (`apps/portal`)** — the big ones: `pages/ReservationsPage.tsx` (the timeline/table
scheduler — drag/resize/pan/zoom/undo), `components/ReservationModal.tsx`, `components/FloorPlanBuilder.tsx`
+ `pages/FloorPlanPage.tsx`, `pages/BlockedPeriodsPage.tsx`, `pages/SetupWizardPage.tsx`,
`components/ResourcesManager.tsx`. Shared TS types in `src/types/index.ts`; status colors in
`components/statusBadge.tsx`; auth in `context/AuthContext.tsx`; API client `src/api/client.ts`.

**Admin (`apps/admin`)** — small: `App.tsx` gates `LoginPage` vs `ConsolePage` on a token boolean
(no router despite react-router being installed). `pages/ConsolePage.tsx` is the whole console;
`components/CreateRestaurantModal.tsx`; client `src/api/client.ts`.

**Shared (`shared/`)** — `floorplan/FloorPlanCanvas.jsx` is the **one** floor-plan renderer used by
both the portal builder (edit) and the customer picker (view). `seed-data.ts` is the canonical demo
dataset, imported by `server/prisma/seed.ts`.

## Conventions & patterns

- **Language split**: portal & admin are strict TypeScript (`tsc -b` must pass before declaring done);
  customer is plain JS/JSX (no `tsc`). `shared` is plain JS/TS. Match the surrounding file's language.
- **Floor-plan coordinates** are `0–100` relative on a fixed SVG viewBox (1000×600), never pixels.
  `Table.position` is the table **center**; `FloorPlanElement.position` is the **top-left**. Both apps
  render from the same `elements + tables` data — there is no second translated format.
- **API clients** default to `import.meta.env.VITE_API_URL || 'http://localhost:4000/api'`. JWT is kept
  in `localStorage`: portal key `tablebooker_portal_token`, admin key `tablebooker_admin_token`; a 401
  auto-clears the token.
- **Serializers, not raw rows**: backend always returns data through `common/serializers.ts` so
  internal fields (e.g. `staffNotes`) never leak to customers.
- **Scheduler math**: reservation positions are in **absolute axis-minutes** (day 0 = 0–1439,
  day 1 = 1440–2879). Use existing `resAbs` / `minToX` / `absToParts` helpers — don't re-derive.
- **Resource mode**: a restaurant is `FLOOR_PLAN` (default) or `RESOURCE_LIST`
  (`reservationRules.resourceMode`). In list mode the customer skips table selection and staff assign
  the table later in the scheduler.
- State is React Context + `localStorage` only — no Redux/Zustand. Tailwind only — no CSS modules.
  Icons from `react-icons` (Feather `Fi*`).

## Gotchas

- **Windows / PowerShell**: `prisma migrate dev` is interactive and **fails in non-interactive
  shells** — hand-write the migration SQL and `prisma migrate deploy`, or run it in a real terminal.
- **`prisma generate` EPERM**: the query-engine DLL is locked while the dev server runs. Stop the
  server before `prisma generate`, then restart.
- **CORS allowlist** is hardcoded in `server/src/main.ts` (`localhost:5173/5174/5175/5180`). A frontend
  served from any other origin gets `Failed to fetch`. `:5180` exists only for the portal preview
  launcher (`.claude/launch.json`).
- **Public restaurant payload has no reservations**: `serializeRestaurant` returns `tables` but **not**
  a `reservations` array (the list/detail endpoints don't include them). Frontend code that reaches for
  `restaurant.reservations` must guard for `undefined` — assuming it exists will crash the page.
- **The backend must be up (`:4000`)** for any frontend to load data.
- **No automated tests** exist (no Jest/Vitest). Verify changes by building (`npm run build` / `tsc -b`)
  and manual/preview checks.
- **`setTables` reconciles, never wipes** (see `HANDOFF.md` §3.7): it updates/creates/deletes tables in
  place so existing reservations keep their `tableId`. Don't refactor it back to delete-and-recreate.

## Git

Default branch is `main`. Commit/push only when asked; if on `main`, branch first. End commit messages
with the required `Co-Authored-By` trailer.
