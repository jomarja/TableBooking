# TableBooker — Setup & Run Guide

A precise, step-by-step guide to get the full stack running locally: the **NestJS API**
plus all **three React frontends** (customer, portal, admin), backed by **PostgreSQL**.

If you just want the short version, see `README.md`. This document is the detailed walkthrough,
including the **no-Docker path** (using a local PostgreSQL such as Postgres.app or Homebrew).

---

## 1. Prerequisites

| Requirement | Version | Check |
|-------------|---------|-------|
| Node.js    | 20 or newer | `node -v` |
| npm        | 10 or newer | `npm -v` |
| PostgreSQL | 16 or newer | see step 3 |

You need PostgreSQL reachable on your machine. You have **two options** — pick one:

- **Option A — Docker** (matches the default docs, uses port **5433**).
- **Option B — Local PostgreSQL** (Postgres.app / Homebrew, uses port **5432**).

> The only difference between them is the **port** in `server/.env` (`5433` vs `5432`).
> Everything else is identical.

---

## 2. Install dependencies

From the repository root:

```bash
npm install
```

This installs every workspace (`server`, `apps/customer`, `apps/portal`, `apps/admin`, `shared`).

---

## 3. Start PostgreSQL

### Option A — Docker (port 5433)

```bash
npm run db:up
```

This starts `postgres:16` in Docker (see `docker-compose.yml`) with:

- user `postgres`, password `postgres`, database `tablebooker`
- host port **5433**

Verify it is listening:

```bash
nc -z localhost 5433 && echo "5433 OPEN"
```

### Option B — Local PostgreSQL (port 5432, no Docker)

If Docker is not installed, use a local PostgreSQL server (e.g. **Postgres.app** or
`brew install postgresql`). Make sure it is running on port **5432**, then create the database:

```bash
createdb -p 5432 -U postgres tablebooker
```

> If your local PostgreSQL has no `postgres` role, create the DB with your own user instead
> (`createdb -p 5432 tablebooker`) and adjust the connection string in step 4 accordingly.

Verify it is listening:

```bash
nc -z localhost 5432 && echo "5432 OPEN"
```

---

## 4. Configure the API environment

Create `server/.env`. If a template exists, copy it first:

```bash
cp server/.env.example server/.env
```

Then set `DATABASE_URL` to match the option you chose in step 3.

**Option A — Docker (port 5433):**

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/tablebooker?schema=public"
JWT_SECRET="local_dev_secret_change_me_at_least_32_chars_long"
JWT_EXPIRES_IN="1d"
API_BASE_URL="http://localhost:4000"
PORT=4000
```

**Option B — Local PostgreSQL (port 5432):**

```env
DATABASE_URL="postgresql://postgres@localhost:5432/tablebooker?schema=public"
JWT_SECRET="local_dev_secret_change_me_at_least_32_chars_long"
JWT_EXPIRES_IN="1d"
API_BASE_URL="http://localhost:4000"
PORT=4000
```

> `JWT_SECRET` can be any string ≥ 32 characters for local dev. In production generate a real one
> with `openssl rand -hex 32`.

---

## 5. Create the database schema

Generate the Prisma client and apply all migrations:

```bash
npm --workspace=@tablebooker/server run prisma:generate
npm --workspace=@tablebooker/server run prisma:migrate
```

You should see all migrations applied and "Your database is now in sync with your schema."

---

## 6. Seed demo data

```bash
npm --workspace=@tablebooker/server run seed
```

This loads 13 restaurants, ~130 tables, ~48 reservations, and blocked periods. It is idempotent —
you can re-run it safely.

---

## 7. Run everything

From the repository root:

```bash
npm run dev
```

This starts the API and all three frontends concurrently. Wait ~15 seconds for everything to boot,
then confirm the ports are live:

```bash
for p in 4000 5173 5174 5175; do nc -z localhost $p && echo "$p OPEN"; done
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4000/api/restaurants   # expect 200
```

Open in the browser:

| App | URL |
|-----|-----|
| Customer (diners) | http://localhost:5173 |
| Portal (staff)    | http://localhost:5174 |
| Admin (platform)  | http://localhost:5175 |
| API               | http://localhost:4000/api |

---

## 8. Demo logins

- **Admin:** `admin@tablebooker.ge` / `admin`
- **Staff (fully configured):** `owner@shavilomi.ge` / `password` (and `owner@<slug>.ge` for each)
- **Staff (first-login setup wizard):** `owner@demobistro.ge` / `password`
- **SMS verification:** any 6 digits

---

## Run individual apps

```bash
npm run dev:server      # NestJS API only (:4000)
npm run dev:customer    # customer app (:5173)
npm run dev:portal      # portal app (:5174)
npm run dev:admin       # admin app (:5175)
```

## Useful database commands

```bash
npm --workspace=@tablebooker/server run prisma:generate   # after editing schema.prisma
npm --workspace=@tablebooker/server run seed              # reseed (idempotent)
npm --workspace=@tablebooker/server run db:reset          # DESTRUCTIVE: drop + migrate + seed
```

---

## Troubleshooting

- **`Failed to fetch` in a frontend** — the API (`:4000`) is not running, or you opened the app from
  an origin not in the CORS allowlist (`server/src/main.ts` allows `5173/5174/5175/5180`).
- **API won't start / DB connection error** — the `DATABASE_URL` port in `server/.env` doesn't match
  your running PostgreSQL. Docker = **5433**, local Postgres.app/Homebrew = **5432**.
- **Port already in use** — each app pins its port with `--strictPort`, so startup fails if the port
  is taken. Stop whatever is using it (`lsof -i :5173`).
- **Empty pages / no restaurants** — you skipped the seed step (step 6), or seeded a different
  database than the one the API connects to (mismatched port).
- **Docker and local Postgres both running** — they use different ports (5433 vs 5432) and are
  different databases. Make sure `server/.env` points at the one you actually migrated and seeded.
```
