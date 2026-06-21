# TableBooker — Project Handoff

A handoff for the next engineer/agent. Covers what the system is, how to run it, what was recently built (the reservation scheduler rework, phases 1–3), what is pending, and the gotchas that will bite you if you don't know them.

---

## 1. What this is

TableBooker is a restaurant reservation platform, a npm-workspaces monorepo:

| Workspace | What it is | Dev port |
|---|---|---|
| `server` | NestJS + Prisma API (PostgreSQL) | `4000` (prefix `/api`) |
| `apps/customer` | Public booking app (React, **plain JS/JSX**) | `5173` |
| `apps/portal` | Restaurant staff app (React + **TypeScript**) | `5174` |
| `apps/admin` | Platform admin console (React + TS) | `5175` |
| `shared` | Seed data + the shared floor-plan renderer (plain JS) | imported by all |

- **DB**: PostgreSQL in Docker (`docker-compose.yml`), exposed on host port **5433** (`postgres/postgres`, db `tablebooker`).
- **Auth**: real JWT + bcrypt + Nest guards (staff vs admin, with restaurant-ownership checks).
- Frontends are Vite + React + Tailwind. Portal/admin are TS; customer is JSX.

### Run it
```bash
# from repo root
npm install
npm run db:up                 # docker postgres on :5433
npm --workspace=@tablebooker/server run prisma:generate
npm --workspace=@tablebooker/server run seed    # seeds restaurants + reservations
npm run dev                   # concurrently: server + all 3 frontends
```
`npm run dev` runs everything via `concurrently`. Individual: `npm run dev:server | dev:portal | dev:customer | dev:admin`.

### Demo logins (portal, `/login`)
- `owner@shavilomi.ge` / `password` — **fully configured restaurant ("Shavi Lomi"), use this for the scheduler**
- `owner@demobistro.ge` / `password` — first-time setup wizard flow

Admin console (`apps/admin`, `:5175`) has its own login.

---

## 2. The reservation scheduler (main recent work)

Everything below lives in **`apps/portal/src/pages/ReservationsPage.tsx`** unless noted. This file contains the page, the `TableScheduler` (timeline/table view — the big one), `DayList` (day view), and `WeekView`. The edit modal is **`apps/portal/src/components/ReservationModal.tsx`**.

The scheduler is a horizontal timeline: rows = tables (grouped by zone), x-axis = time across a **2-day window** (`WINDOW_DAYS = 2`) starting at the selected `date`. Positions are computed in **absolute axis-minutes** (day 0 = minutes 0–1439, day 1 = 1440–2879). `minToX()` maps minutes → px using `pxPerHour` (zoom). The left "Table" column is **sticky**; the time header is **sticky top**.

### 2.1 Reservation status model
Statuses: **PENDING → CONFIRMED → SEATED → COMPLETED**, plus **CANCELLED**. **`NO_SHOW` was removed** (enum, types, UI). Lifecycle:
- **Move a reservation** (drag) → set back to **PENDING** (unless it's SEATED/COMPLETED/CANCELLED, which are preserved). Pending shows a **bell** badge.
- **Bell** → CONFIRMED. **Tick** (appears once `now ≥ start`) → SEATED.
- **Auto-complete**: a SEATED reservation whose end time has passed is auto-PATCHed to **COMPLETED** (effect in `ReservationsPage`, guarded by `completingRef`).
- Colors (status-driven; spec'd by the product owner): **PENDING = orange, CONFIRMED = indigo/brand purple, SEATED = amber/yellow, COMPLETED = gray, CANCELLED = gray + strikethrough**. Also any booking whose **end is in the past** renders with COMPLETED (gray) styling + reduced opacity (`reservationVisual(r, now)`). Mirrored in `components/statusBadge.tsx` (badge styles + `RESERVATION_STATUSES`).
- **CANCELLED stays visible everywhere** (timeline, day list) — it is **NOT archived**. Both the modal "Cancel reservation" button and the card right-click "Cancel" set `status = CANCELLED` (no archive). Backend already excludes CANCELLED from availability and the per-slot cap, so cancelled bookings don't block. (The reservation archive endpoint still exists for a future admin-only delete.)

### 2.2 Drag / resize / pan (Phase 2)
- **Move**: drag a card; it tracks the cursor 1:1 and can move between table rows (nearest row by cursor-Y). Vertical **edge auto-scroll** brings off-screen rows into reach.
- **Collision prevention**: overlaps are impossible. While dragging, the target row/card shows **green (valid)** or **red (would overlap)**. On drop, the move **snaps to the nearest collision-free gap** (`resolvePlacement` / `occupiedOn` / `overlapsAny`). If the table is full, the move is cancelled.
- **Resize from both edges**: left handle moves start, right moves end; each **clamps flush against the neighbouring booking**; snaps to 15 min; shows a live **duration preview** ("2h 30m").
- **2D panning**: drag empty background (mouse) pans both axes; **middle-mouse** drags from anywhere; trackpad/touch pan natively (manual pan is mouse-only to avoid fighting native touch scroll).
- **Performance**: pointer moves are coalesced to one preview update per frame via a single `requestAnimationFrame` loop (`dragTick` + `dragDirtyRef`); the dragged card is positioned with `transform: translateX()` (compositor-only, no per-frame layout). This is what keeps drag smooth.
- **Right-click context menu** on a card: Edit / Mark seated / Mark completed / Cancel (shown contextually by status).

### 2.3 Current-time indicator (Phase 1/2/3)
- Soft 2px red line at `red-500/70`; time pill (e.g. `21:54`) sits to the **right** of the line so it's never tucked under the sticky column.
- **Never renders inside the Table column**: table label cells (`z-10`) and a full-width opaque sticky cover on **zone-header strips** (`z-20`) clip the line (`z-5`); zone strips are `z-10` + translucent so the line passes **softly behind** zone headers.
- **Toggle setting**: a clock button in the toolbar toggles "Show current-time indicator" (default ON, persisted to `localStorage` key `tb_showNowLine`). Passed to `TableScheduler` as `showNow`.

### 2.4 Zoom & layout (Phase 3, done)
- **Viewport-centered zoom**: all zoom paths (Ctrl/⌘+wheel, −/+ buttons, reset) go through `applyZoom`, which preserves the axis-time at the viewport center across scale changes (records anchor, sets `scrollLeft` in a `useLayoutEffect` after the new width lands). No more jump.
- **No empty trailing column**: timeline content is pinned to exact `width + LABEL_W` (was `minWidth` + per-row `flex-1` spacers, which created a stray light column after the last slot — removed). On very wide screens the right gutter is just the white card background.
- **Floating day indicator** (Phase 3): a small pill at the top-center of the scheduler always shows the in-view day (`dateLabel(days[inViewDay].date)`), updated from horizontal scroll via `onSchedScroll` (rAF-throttled; re-renders only when the day index changes). Gives orientation while scrolling across the window.

### 2.5 Modal (`ReservationModal.tsx`)
Grouped into 4 sections: **Guest Information / Reservation Details / Status / Notes**. "Person left" button was removed (status flow + auto-complete cover it). Quick actions: Confirm (when PENDING), Arrived (→ SEATED). "Cancel reservation" sets CANCELLED (see 2.1).

---

## 3. Pending / not done — START HERE

### 3.1 ⚠️ Unapplied DB migration (do this carefully)
The **Google Maps import/sync feature was fully removed** (code + UI in portal & admin + backend + Prisma schema). The migration that drops the `importSource`/`googleSyncedAt` columns and the `ImportProvider` enum was **created but NOT applied**, on purpose:

- File: `server/prisma/migrations/20260617010000_remove_google_import/migration.sql`
- It was left unapplied because the running `nest --watch` server holds the **old generated Prisma client** (which still SELECTs those columns) and `prisma generate` can't run while the server has the engine DLL locked. Dropping the columns live would break every restaurant read until the client is regenerated + server restarted.
- **To finish it**: stop the dev server, then:
  ```bash
  cd server
  npx prisma migrate deploy
  npx prisma generate
  ```
  then restart `npm run dev`. (The earlier `20260617000000_remove_no_show` migration **was** applied.)
- The app works fine until then — the two columns just sit unused.

### 3.2 Phase 3 remaining (explicitly deferred)
- **DOM virtualization** for 50+ tables / 100+ reservations: a lightweight version (skipping off-screen rows' gridlines) was prototyped then **removed at the owner's request ("skip the virtualization part")**. If revisited: render only table rows whose vertical band intersects the viewport (+overscan). Keep every row's box in flow (so the now-line spans full height and `[data-table-id]` drag-targeting + auto-scroll still work) and skip only the heavy timeline-cell children. Or do true windowing with spacers. Verify with the preview setup (§5).
- **True bidirectional / extending infinite timeline**: currently the window is a fixed 2 days forward from `date`; scrolling left to previous days isn't possible without the date chevrons. The floating day indicator + forward scroll are done. Full version: a rolling/extending day window that loads prev/next days as you scroll the edges, shifting the date base and keeping the selected day positioned, with the toolbar date staying in sync. This is the larger rewrite; keep orientation (current date, day range, nav controls always visible) — don't let users get lost.

### 3.3 ✅ Blocked Periods page rework — DONE
`apps/portal/src/pages/BlockedPeriodsPage.tsx` was rewritten: filter tabs **Today / Upcoming / Completed / All** (default Today), scheduler-style **date navigator** (prev/next/picker/Today) shown in the Today view, a **table** (Reason · Date · Start · End · Affected resource · Status · ⋮), per-row **⋮ menu** (Edit / Duplicate / Delete), **auto-computed status** (active=orange, upcoming=blue, completed=gray — past blocks auto-show Completed with reduced emphasis), a prominent **Block Period** button, and an extended `BlockForm` that handles both create and **edit** (reuses existing `api.createBlocked`/`updateBlocked`). No backend/migration changes. Verified in the :5180 preview.

### 3.4 ✅ Resource Management Mode — DONE (migration-free)
Restaurants can manage resources as a floor plan **or** a manual list (tables / rooms / spaces). Implemented **without a schema migration** by storing config in the existing `reservationRules` JSON blob:
- **Types** (`apps/portal/src/types/index.ts`): `ResourceMode = 'FLOOR_PLAN' | 'RESOURCE_LIST'`; `reservationRules.resourceMode` and `reservationRules.resourceMeta: Record<tableId, {name?, description?}>`.
- **Helper** `apps/portal/src/lib/resources.ts`: `getResourceMode(r)`, `resourceLabel(r, table)` (custom name or "Table N").
- **Settings → Booking & Visibility → Reservation Configuration**: card to pick Floor Plan / Resource List mode (persisted via `updateRestaurant({ reservationRules: {...prev, resourceMode} })`).
- **Settings → Resources tab** (`apps/portal/src/components/ResourcesManager.tsx`): CRUD over resources (Name, Capacity, Zone, Description). Resources are `Table` rows (created with a client-generated id + auto-assigned `number` + default geometry via `api.setTables`); name/description go into `resourceMeta`.
- **Scheduler + day list** (`ReservationsPage.tsx`): rows/labels use `resourceLabel` (custom name shows; falls back to "Table N"). Works identically in both modes.
- **Customer app** (`apps/customer/src/pages/RestaurantPage.jsx`): in Resource List mode `allowTableSelection` is forced false, so the floor-plan/table-selection step is hidden and the booking submits with no `tableId` — **staff assign later** in the scheduler.
- Verified Steps in the :5180 preview (mode card, Resources CRUD add/delete, scheduler shows "VIP Table"). Customer-side change is a one-liner over the existing no-table path (not separately previewed — would need a customer instance + the restaurant set to RESOURCE_LIST).

**Optional follow-ups** (not done): auto-assign a free resource at booking time (`createCustomer` accepts optional `tableId`; pick via availability) instead of leaving it for staff; the small **resource-type badge** (TABLE/ROOM/VIP/CONFERENCE — spec called it "future"); and promoting `resourceMeta` to real `Table.name`/`description` columns during a migration window (also apply the pending `remove_google_import` migration then — see §3.1).

### 3.5 ✅ Reservation modal redesign — DONE
`apps/portal/src/components/ReservationModal.tsx` rebuilt for speed/low cognitive load:
- **Summary card** at top (name + status badge; guests, phone, resource; date, time range, duration) — understand the booking at a glance.
- **One-click status actions** (Pending / Confirmed / Arrived[=SEATED] / Completed / Cancelled), current highlighted — no dropdown.
- **Smart time inputs**: `normalizeTime` parses `18`→18:00, `1830`→18:30, `9`→09:00, `18:45`→18:45 on blur/Enter. **Extend** chips +30m/+60m/+90m/+120m bump the end time.
- **Undo/redo** (`Ctrl+Z` / `Ctrl+Shift+Z` / `Ctrl+Y`, plus header buttons) over all fields — history with per-field coalescing so typing is one step.
- **Copy/Duplicate**: `Ctrl+C` copies the reservation (module-level clipboard), `Ctrl+V` pastes into a draft, `Ctrl+D` duplicates (creates a PENDING copy via API).
- **Notes collapsed** by default (`Notes (n)` toggle).
- **Sticky footer** (flex-col modal: header / scroll body / footer) — Cancel reservation · Close · Save Changes always visible.
- **Keyboard**: `Esc` close, `Enter` save (except in textarea / time field), native Tab order.
- Verified live in the :5180 preview: layout, status→badge, +60m→end extend, undo/redo (CONFIRMED→COMPLETED→undo→CONFIRMED→redo→COMPLETED). Time-normalization-on-blur and the copy/paste/duplicate shortcuts are standard handlers verified by code review (the preview tool can't simulate real blur / clipboard).

### 3.6 ✅ Scheduler undo/redo — DONE
Session-only undo/redo for the **whole scheduler** (separate from the modal's field-level undo), in `ReservationsPage.tsx`:
- Global **`Ctrl+Z` / `Ctrl+Shift+Z` / `Ctrl+Y`** (gated off while a modal is open or while typing in a control, so it doesn't clash with the modal's own undo).
- A `{ stack, index }` history (depth `HISTORY_LIMIT = 50`). Each entry is `{ id, before, after, label }` (exact field snapshots). `applyState(id, fields)` optimistically updates local `reservations` then PATCHes — used for the forward edit **and** undo/redo, so undo is instant, works before backend sync, and restores the exact state with **no collision logic** (undo always succeeds).
- Records one entry per finished action: **drag move / resize** (in `onPointerUp`, via the `onHistory` prop — refactored to run side-effects outside the `setPreview` updater + a `previewRef`), **status changes** (`setStatus`), and **modal saves/cancel** (the modal computes a `before/after` diff via `buildHistory()` and passes it through `onSaved(notify, id, history)`).
- **Toast** (bottom-center) after each action with an inline **Undo**/**Redo** button; auto-dismiss ~5s.
- Verified live in the :5180 preview: status change → "Status updated" toast, `Ctrl+Z` → "Undone", `Ctrl+Y` → reapplied; no console errors.

### 3.7 ✅ `setTables` reconcile fix — tables unified, bookings preserved
**Bug:** `RestaurantsService.setTables` did `deleteMany` + recreate. Deleting tables fires `onDelete: SetNull` on `Reservation.tableId`, so **every table edit — from the Resources page or a Floor Plan save — unassigned every reservation** (they vanished from the scheduler). Newly added resources persisted but bookings were silently orphaned.
**Fix** (`server/src/restaurants/restaurants.service.ts`): `setTables` now **reconciles** — update existing tables in place (matched by id), create new ones, delete only the ones removed. Kept tables retain their id, so reservations stay assigned; only genuinely-removed tables detach their bookings (intended). Resources page, scheduler, and floor plan all operate on the same `Table` rows via this one method, so they stay in sync and add/delete propagates both ways. Verified by direct API test (reservation `tableId` preserved across a table add + remove) and in the preview (added resource shows as a new scheduler row; assignments intact).

---

## 4. Where things live

- Scheduler / timeline / day / week views: `apps/portal/src/pages/ReservationsPage.tsx`
- Edit/create modal: `apps/portal/src/components/ReservationModal.tsx`
- Status colors + list: `apps/portal/src/components/statusBadge.tsx`
- Channel icons: `apps/portal/src/components/channel.tsx`
- Portal types: `apps/portal/src/types/index.ts`
- Portal API client: `apps/portal/src/api/client.ts` (`VITE_API_URL` or `http://localhost:4000/api`; token in `localStorage['tablebooker_portal_token']`)
- Backend reservations: `server/src/reservations/*` (`reservations.service.ts` has create/update/list/archive)
- Availability (excludes CANCELLED): `server/src/availability/availability.service.ts`
- Serializers (Prisma row → JSON): `server/src/common/serializers.ts`
- Prisma schema + migrations: `server/prisma/`
- Seed: `server/prisma/seed.ts` + `shared/seed-data.ts`
- CORS allowlist: `server/src/main.ts`

---

## 5. Gotchas / environment

- **OS is Windows**; default shell is PowerShell. Prisma `migrate dev` is interactive and **fails in non-interactive shells** — hand-write the migration SQL and apply with `prisma migrate deploy`, or run `migrate dev` in a real terminal.
- **`prisma generate` fails with `EPERM`** while the server is running (the query-engine DLL is locked). Stop the server first.
- **Verifying the portal in a preview** while the owner's dev server occupies `:5174`: a second Vite instance was used on **`:5180`** (`.claude/launch.json` → `portal-preview`, runs `npx vite apps/portal --port 5180`). For its API calls to work, **`http://localhost:5180` was added to the CORS allowlist** in `server/src/main.ts`. Both are dev-only artifacts — keep them if you'll keep verifying, or remove if you want the allowlist clean. Log in from that instance by POSTing `/api/auth/login` and setting `localStorage['tablebooker_portal_token']` (the login UI also works).
- The backend must be up (`:4000`) for any frontend to load data.

---

## 6. Conventions
- Match surrounding code style; portal/admin are strict TS (`tsc -b --noEmit` must pass — run it in the workspace before declaring done).
- Reservation positions are always in **absolute axis-minutes**; use the existing `resAbs` / `minToX` / `absToParts` helpers rather than re-deriving.
- Don't reintroduce `NO_SHOW`. A no-show is modeled as CANCELLED (kept visible).
