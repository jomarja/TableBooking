# TableBooker

A restaurant reservation platform with **three separate frontends** over **one shared backend/database**:

| App | Stack | Port | Who |
|-----|-------|------|-----|
| `apps/customer` | React + Vite + **JS** + Tailwind | 5173 | Diners — discover restaurants & book tables |
| `apps/portal`   | React + Vite + **TS** + Tailwind | 5174 | Restaurant staff — dashboard, reservations, floor plan, blocked periods |
| `apps/admin`    | React + Vite + **TS** + Tailwind | 5175 | Platform admins — create/approve/disable restaurants, reset passwords, stats |
| `server`        | **NestJS + Prisma + PostgreSQL** | 4000 | Shared REST API (`/api`) |
| `shared`        | seed data + the single floor-plan renderer | — | imported by the backend and both relevant frontends |

A reservation or blocked period created in the portal is **immediately visible** (and blocking) in the customer booking flow, because everything reads/writes the same Postgres database.

## Prerequisites

- Node 20+ and npm 10+
- PostgreSQL reachable at `postgresql://postgres:postgres@localhost:5433/tablebooker`
  (a `docker-compose.yml` is provided: `npm run db:up` starts `postgres:16` on port 5433)

## First-time setup

```bash
npm install                  # installs all workspaces
npm run db:up                # start Postgres (or point server/.env at your own)
cp server/.env.example server/.env   # if not present
npm --workspace=@tablebooker/server run prisma:migrate   # create schema
npm --workspace=@tablebooker/server run seed             # 12 Georgian restaurants + demo data
```

## Run everything

```bash
npm run dev      # server + customer + portal + admin concurrently
```

Then open:
- Customer: http://localhost:5173
- Portal: http://localhost:5174
- Admin: http://localhost:5175

## Demo logins

- **Admin:** `admin@tablebooker.ge` / `admin`
- **Staff (set up):** `owner@shavilomi.ge` / `password` (and `owner@<slug>.ge` for each)
- **Staff (first-login wizard):** `owner@demobistro.ge` / `password`
- **SMS verification:** any 6 digits

## Architecture notes

- **Single floor-plan model** (`shared/floorplan`): the portal's drag-and-drop builder and the
  customer's booking floor plan render from the exact same `elements` + `tables` data — no
  translated second format. Coordinates are 0–100 relative on a fixed SVG viewBox.
- **Blocked periods** are orange in the portal but render as ordinary red/un-bookable slots to
  customers (a blocked table simply can't be booked).
- **Soft delete** everywhere (`isArchived` + `deletedAt`); reads filter archived rows.
- **Auth** is real JWT + bcrypt + Nest guards (staff vs admin, with restaurant-ownership checks).
- Notifications, SMS verification, and Google-Maps import are mocked for the demo.

## Per-workspace scripts

```bash
npm run dev:server        # NestJS in watch mode
npm run dev:customer      # customer app
npm run dev:portal        # portal app
npm run dev:admin         # admin app
npm run build             # build API + all three frontends
```
