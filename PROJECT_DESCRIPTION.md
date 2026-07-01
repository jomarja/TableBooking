# TableBooker — Project Description

## Overview

TableBooker is a full-stack restaurant reservation platform designed to streamline the end-to-end booking experience for diners, restaurant staff, and platform administrators. The system supports real-time table availability, interactive floor-plan selection, reservation lifecycle management, and admin oversight — all from a single unified backend.

The project is built as a monorepo containing three independent frontend applications and one shared NestJS REST API backed by a PostgreSQL database.

---

## Architecture & Tech Stack

**Monorepo structure (npm workspaces):**

| Workspace | Technology | Role |
|-----------|-----------|------|
| `apps/customer` | React + Vite + JavaScript + Tailwind | Diner-facing booking interface |
| `apps/portal` | React + Vite + TypeScript + Tailwind | Restaurant staff operations dashboard |
| `apps/admin` | React + Vite + TypeScript + Tailwind | Platform administration console |
| `server` | NestJS + TypeScript + Prisma | REST API, business logic, auth |
| `shared` | TypeScript | Floor-plan renderer, shared types |

**Database:** PostgreSQL via Prisma ORM — full schema migrations, soft-delete architecture, and a seeded dataset of 12 demo restaurants.

**Auth:** JWT-based authentication with bcrypt password hashing and role-based guards (customer, staff, admin).

---

## Key Features

- **Customer booking flow** — Browse restaurants, view real-time available slots, select seating from an interactive SVG floor plan, and submit or manage reservations.
- **Staff portal** — Dashboard with today's reservations, drag-and-drop floor-plan builder, blocked period scheduling (single or recurring), status updates (PENDING → CONFIRMED → SEATED → COMPLETED), and a first-login setup wizard.
- **Admin console** — Restaurant onboarding and approval workflow (PENDING → APPROVED / DISABLED), staff credential management, and platform-wide statistics.
- **Floor plan engine** — A unified floor-plan model (tables with CIRCLE / SQUARE / RECT shapes, zones, decorative elements) rendered from coordinate percentages on an SVG viewBox and shared between the staff builder and customer picker.
- **Availability engine** — Real-time slot calculation that accounts for existing reservations, blocked periods, opening hours, and per-restaurant reservation rules.
- **Audit trail** — Every reservation state change is logged as a `ReservationEvent`, preserving a full history including table changes, time changes, and cancellations.

---

## Development Workflow

The team followed a feature-branch workflow on Git. The backend schema was defined first in Prisma, migrations were applied, and then frontend apps consumed the API iteratively. The three frontends were developed in parallel with shared API client types to maintain consistency. Seed data was used throughout development to avoid manual database setup.

---

## Team Contributions

### Giorgi Jomarjidze

Giorgi led the **backend architecture and server-side development**. He designed the Prisma database schema, authored the core NestJS modules (restaurants, reservations, availability, admin, auth), and set up the monorepo workspace structure. He implemented the availability calculation engine — the most logic-intensive component — which resolves open slots by intersecting opening hours, blocked periods, and existing reservations. He also handled JWT authentication, role-based guards, database migrations, and the seed data pipeline.

### Nikoloz Jvebenava

Nikoloz owned the **restaurant staff portal** (`apps/portal`). He built the reservation management dashboard, the status-update flows, and the floor-plan builder that allows staff to drag-and-drop tables and zones onto a canvas. He implemented the blocked-period scheduling UI with support for single events and recurring patterns, and developed the first-login setup wizard that walks new restaurant staff through configuring their profile and floor plan. He also contributed to the shared floor-plan renderer used across both the portal and customer app.

### Archil Margvelashvili

Archil was responsible for the **customer-facing application** (`apps/customer`) and the **admin console** (`apps/admin`). On the customer side, he built the restaurant discovery and search flow, the interactive floor-plan seat picker, real-time slot availability display, and the reservation booking and cancellation experience. On the admin side, he implemented the restaurant onboarding and approval workflow, staff credential management, and the platform statistics dashboard. He also handled the frontend API client integration layer that both the portal and admin apps use to communicate with the backend.

---

## Summary

TableBooker demonstrates a production-grade multi-tenant SaaS architecture: a single API serving three distinct user roles, a shared domain model for floor plans and reservations, and a clean separation between the concerns of customers, restaurant operators, and platform administrators. Each team member owned a vertical slice of the system while contributing to shared components, resulting in a consistent and well-integrated product.
