# Logistics Shipment Booking & Tracking System

A full-stack MERN application that enables shippers to search carrier services, create multi-leg shipment bookings, and track delivery status through a controlled lifecycle.

---

## Table of Contents

1. [Tech Stack](#tech-stack)
2. [Architecture Overview](#architecture-overview)
3. [Database Design](#database-design)
4. [Key Business Rules](#key-business-rules)
5. [Concurrency & Idempotency](#concurrency--idempotency)
6. [Transaction Boundaries](#transaction-boundaries)
7. [API Reference](#api-reference)
8. [Frontend Workflows](#frontend-workflows)
9. [Running the System](#running-the-system)
10. [Environment Variables](#environment-variables)
11. [Design Trade-offs & Assumptions](#design-trade-offs--assumptions)
12. [Known Limitations](#known-limitations)

---

## Tech Stack

| Layer         | Technology                                          |
| ------------- | --------------------------------------------------- |
| Runtime       | Node.js 18+                                         |
| Backend       | Express 4, TypeScript 5, Mongoose 8, Zod 3          |
| Database      | MongoDB 7 (replica set — required for transactions) |
| Frontend      | React 18, TypeScript, Vite, React Router 6          |
| Data fetching | React Query (@tanstack/react-query)                 |
| Containers    | Docker, Docker Compose                              |

---

## Architecture Overview

The codebase is split into two top-level packages:

```
task/
├── backend/       Node.js / Express API
│   ├── src/
│   │   ├── modules/
│   │   │   ├── carriers/      Carrier Catalogue Service
│   │   │   └── shipments/     Shipment Service
│   │   ├── common/            AppError, errorHandler middleware
│   │   ├── routes/            Express routers
│   │   ├── app.ts             Express app setup
│   │   ├── server.ts          MongoDB connect + server start
│   │   └── seed.ts            One-time carrier data seeder
│   └── openapi.yaml           OpenAPI 3.1 specification
└── frontend/      React + Vite SPA
    └── src/
        ├── api/               Axios client + typed API functions
        ├── hooks/             useDebounce
        └── pages/             CarrierSearch, Draft, Review, Tracking, Detail
```

### Service boundaries

**Carrier Catalogue Service** (`src/modules/carriers/`)

- Owns: `Carrier`, `CarrierService` collections
- Responsibilities: carrier search, capacity limits, base pricing, transit days

**Shipment Service** (`src/modules/shipments/`)

- Owns: `Shipment`, `ShipmentLeg`, `ShipmentStatusHistory` collections
- Responsibilities: lifecycle, leg management, capacity validation, submission, exceptions, audit history

---

## Database Design

### Collections and schemas

#### `carriers`

| Field   | Type     | Constraints        |
| ------- | -------- | ------------------ |
| `_id`   | ObjectId | PK                 |
| `name`  | String   | required           |
| `code`  | String   | required, unique   |
| `modes` | String[] | enum: air/sea/road |

#### `carrier_services`

| Field            | Type     | Constraints                                          |
| ---------------- | -------- | ---------------------------------------------------- |
| `_id`            | ObjectId | PK                                                   |
| `carrierId`      | ObjectId | FK → carriers, required                              |
| `carrierGroupId` | String   | required — groups multi-leg routes under one carrier |
| `mode`           | String   | enum: air/sea/road                                   |
| `origin`         | String   | required                                             |
| `destination`    | String   | required                                             |
| `maxWeight`      | Number   | kg capacity                                          |
| `maxVolume`      | Number   | m³ capacity                                          |
| `basePrice`      | Number   | live pricing (snapshotted at booking)                |
| `currency`       | String   |                                                      |
| `transitDays`    | Number   |                                                      |
| `active`         | Boolean  | default true; filters search                         |

Indexes: `{ origin, destination, mode }`, `{ carrierId }`

#### `shipments`

| Field                  | Type     | Constraints                                                                                 |
| ---------------------- | -------- | ------------------------------------------------------------------------------------------- |
| `_id`                  | ObjectId | PK                                                                                          |
| `shortId`              | String   | unique — human-readable draft ID (last 6 hex chars of ObjectId, uppercased)                 |
| `shipmentNumber`       | String   | unique, sparse — generated at submission (`SHP-{timestamp}-{shortId}`)                      |
| `shipper`              | Object   | `{ name, contactEmail }`                                                                    |
| `pickupAddress`        | Object   | `{ line1, line2?, city, country }`                                                          |
| `deliveryAddress`      | Object   | `{ line1, line2?, city, country }`                                                          |
| `cargo`                | Object   | `{ type, weight, volume }`                                                                  |
| `requiredDeliveryDate` | Date     | optional                                                                                    |
| `carrierGroupId`       | String   | set when legs are added; enforces single-carrier rule                                       |
| `status`               | String   | enum: Draft/Booked/InTransit/Delivered/Closed/Exception                                     |
| `version`              | Number   | optimistic locking counter                                                                  |
| `snapshot`             | Object   | immutable at submission: `{ totalPrice, currency, totalTransitDays, estimatedArrivalDate }` |
| `idempotencyKey`       | String   | stores the Idempotency-Key used for submission                                              |

Indexes: `shortId` (unique), `shipmentNumber` (unique, sparse), `idempotencyKey` (sparse)

#### `shipment_legs`

| Field                | Type     | Constraints                                      |
| -------------------- | -------- | ------------------------------------------------ |
| `_id`                | ObjectId | PK                                               |
| `shipmentId`         | ObjectId | FK → shipments                                   |
| `sequence`           | Number   | ordering within shipment                         |
| `carrierServiceId`   | ObjectId | FK → carrier_services                            |
| `mode`               | String   | snapshotted from service                         |
| `origin`             | String   | snapshotted from service                         |
| `destination`        | String   | snapshotted from service                         |
| `scheduledDeparture` | Date     |                                                  |
| `scheduledArrival`   | Date     |                                                  |
| `transitDays`        | Number   | snapshotted from service                         |
| `price`              | Number   | snapshotted from service at leg creation         |
| `currency`           | String   | snapshotted                                      |
| `status`             | String   | enum: Draft/Booked/InTransit/Delivered/Exception |
| `exception`          | Object   | `{ reasonCode, description?, resolvedAt? }`      |

Indexes: `{ shipmentId, sequence }` (unique), `{ carrierServiceId }`

#### `shipment_status_history`

| Field        | Type     | Constraints      |
| ------------ | -------- | ---------------- |
| `_id`        | ObjectId | PK               |
| `shipmentId` | ObjectId | FK → shipments   |
| `changedAt`  | Date     | required         |
| `fromStatus` | String   |                  |
| `toStatus`   | String   | required         |
| `reasonCode` | String   | exception reason |
| `note`       | String   |                  |

Index: `{ shipmentId, changedAt }`

### Shipment number generation

```
SHP-{YYYYMMDDHHMMSS}-{shortId.toLowerCase()}
e.g. SHP-20260304175040-09974a
```

`shortId` is the last 6 hex characters of the MongoDB `ObjectId`, uppercased. It is stored on creation so draft shipments are searchable before a formal shipment number is assigned.

---

## Key Business Rules

### Lifecycle state machine

```
Draft → Booked → InTransit → Delivered → Closed
                     ↕
                 Exception
```

- `Exception` can occur during `InTransit`. Once resolved, the shipment may resume progressing.
- Shipment status is **derived** from leg statuses (rollup logic):
  - Any leg `Exception` → shipment `Exception`
  - All legs `Delivered` → shipment `Delivered`
  - Any leg `InTransit` → shipment `InTransit`
  - Any leg `Booked` → shipment `Booked`
  - Otherwise → `Draft`

### Single carrier group

All legs in a shipment must belong to the same `carrierGroupId`. Adding legs that mix groups returns **HTTP 409 Conflict**. The constraint is enforced in the service layer on every leg save operation.

### Capacity validation

`cargo.weight` and `cargo.volume` are compared against the minimum of `maxWeight`/`maxVolume` across all selected carrier services. Exceeding either returns **HTTP 400** with structured details (`totalWeight`, `totalVolume`, `maxWeight`, `maxVolume`).

### Pricing snapshot

While in `Draft`, the leg `price` reflects `CarrierService.basePrice` at the time the leg was last saved. On submission, `shipment.snapshot` is computed and frozen — it is never recomputed from live catalogue data thereafter, preserving historical integrity.

---

## Concurrency & Idempotency

### Optimistic locking (drafts)

- `Shipment.version` is incremented on each draft update.
- Update requests include the current `version`; the server does `findOne({ _id, status: 'Draft', version })`.
- If the document has been modified concurrently, the query returns no result and a **409** is returned, prompting the client to refetch and retry.

### Idempotent submission

- `POST /api/shipments/{id}/submit` requires an `Idempotency-Key` header (a UUID generated by the client and held stable across retries using `useRef`).
- If a submitted shipment already has the same `idempotencyKey`, the existing booking is returned immediately — no duplicate is created.
- The submit operation runs in a MongoDB transaction spanning `Shipment`, `ShipmentLeg` reads, and `ShipmentStatusHistory` write, ensuring all-or-nothing atomicity.

---

## Transaction Boundaries

Operations that touch multiple collections atomically use `mongoose.startSession()` + `session.startTransaction()`:

| Operation              | Collections touched                                |
| ---------------------- | -------------------------------------------------- |
| Submit shipment        | Shipment (update) + ShipmentStatusHistory (insert) |
| Update leg/ship status | Shipment + ShipmentLeg + ShipmentStatusHistory     |
| Create exception       | ShipmentLeg + Shipment + ShipmentStatusHistory     |
| Resolve exception      | ShipmentLeg + Shipment + ShipmentStatusHistory     |

On any error the transaction is aborted; no partial writes are persisted. The API returns 4xx for client errors and 5xx for unexpected failures. All submission endpoints are safe to retry.

> **Note:** MongoDB transactions require a replica set. The provided `docker-compose.yml` starts MongoDB with `--replSet rs0` and auto-initiates the replica set, so no manual setup is needed.

---

## API Reference

Full schema definitions are in `backend/openapi.yaml` (OpenAPI 3.1).

### Carrier Catalogue

| Method | Path                     | Description                                                                                                                                                                                                       |
| ------ | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/api/carriers/services` | Search carrier services. Params: `q` (origin OR destination free-text), `origin`, `destination`, `mode`, `carrierId`, `sort` (price/transitTime), `page`, `pageSize`. All text params use case-insensitive regex. |

### Shipments

| Method | Path                                           | Description                                                                                                  |
| ------ | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| POST   | `/api/shipments/drafts`                        | Create a new shipment draft                                                                                  |
| GET    | `/api/shipments`                               | List shipments. Params: `status`, `shipmentNumber` (searches both `shipmentNumber` and `shortId` with regex) |
| GET    | `/api/shipments/:id`                           | Get shipment detail with legs and timeline history                                                           |
| PATCH  | `/api/shipments/:id`                           | Update draft header (requires `version` for optimistic locking)                                              |
| POST   | `/api/shipments/:id/legs`                      | Add or replace legs (single carrier group + capacity enforced)                                               |
| DELETE | `/api/shipments/:id/legs/:legId`               | Remove a leg from a draft                                                                                    |
| POST   | `/api/shipments/:id/submit`                    | Submit draft → Booked. Requires `Idempotency-Key` header                                                     |
| POST   | `/api/shipments/:id/status`                    | Transition leg or shipment status                                                                            |
| POST   | `/api/shipments/:id/exceptions`                | Record an exception on a leg (`reasonCode` required)                                                         |
| POST   | `/api/shipments/:id/exceptions/:legId/resolve` | Resolve an exception and resume transit                                                                      |

### Error responses

| Status | Meaning                                                                        |
| ------ | ------------------------------------------------------------------------------ |
| 400    | Validation error — Zod field-level details returned                            |
| 404    | Resource not found                                                             |
| 409    | Business rule conflict (carrier mismatch, version conflict, already submitted) |
| 500    | Unexpected server error                                                        |

---

## Frontend Workflows

### Carrier search (`/`)

- Search by origin, destination, transport mode, and sort order.
- All text inputs are debounced (400 ms) to avoid excessive API calls.
- The `q` parameter matches both origin and destination, so typing "Dubai" surfaces services departing from or arriving in Dubai.
- Results show carrier group, mode, route, transit days, capacity limits, and price.
- URL parameters reflect all active filters for shareable/bookmarkable state.

### Booking flow

**Step 1 — Draft (`/shipments/new`)**

- Collects shipper name, contact email, pickup/delivery addresses, cargo type, weight, volume, and optional required delivery date.
- Full client-side + server-side validation with field-level error messages.
- Creates a draft via `POST /api/shipments/drafts` and redirects to the detail page.

**Step 2 — Add legs (`/shipments/:id`)**

- Available when status is `Draft`.
- Inline `LegEditor` component:
  - Free-text search for carrier services (by origin or destination, debounced).
  - Select a service from a dropdown panel showing route, mode, transit, price, and capacity.
  - Date/time pickers for scheduled departure and arrival, with full validation:
    - Required fields
    - Invalid date detection (guards against browser partial-fill edge cases)
    - Arrival must be after departure
    - Field-level inline error messages with red border highlight
  - Running totals (total price, transit days, ETA) update after each leg is added.
  - All legs must share the same `carrierGroupId`; the backend enforces this with a 409 on violation.

**Step 3 — Review & submit (`/shipments/:id/review`)**

- Displays snapshotted pricing and route summary.
- Submit button calls `POST /api/shipments/:id/submit` with a stable `Idempotency-Key` (generated once per review session via `useRef`, surviving re-renders and retries).
- On success, redirects to the tracking detail view.

### Tracking

**List view (`/shipments`)**

- Lists all shipments with status filter and shipment number search.
- Search works against both formal `shipmentNumber` and `shortId` (draft identifier), so shipments are findable at any lifecycle stage.
- Status badges, route summary, and last-updated time are shown per row.

**Detail view (`/shipments/:id`)**

- Header card: shipper info, cargo, addresses, status badge.
- Snapshot panel (visible after booking): locked-in total price, transit days, ETA.
- Legs table: route, mode, departure/arrival, per-leg status badge.
- Timeline: full audit history of status changes with timestamps, reason codes, and notes.

---

## Running the System

### Prerequisites

- Docker Desktop (recommended) — or a local MongoDB 7 replica set
- Node.js 18+

### Quick start with Docker Compose

```bash
# 1. Start MongoDB (configured as single-node replica set for transaction support)
docker compose up -d

# 2. Install backend dependencies and seed carrier data
cd backend
npm install
npm run seed

# 3. Start backend dev server
npm run dev

# 4. In a new terminal, start the frontend
cd ../frontend
npm install
npm run dev
```

Open **http://localhost:5173**. The Vite dev server proxies all `/api` calls to the backend on port 4000.

### Seed data

The seed script (`npm run seed` from `backend/`) is idempotent — safe to run multiple times. It upserts:

- **5 carriers**: Maersk Line, Emirates SkyCargo, Aramex Freight, MSC Logistics, DHL Express
- **18 carrier services** across air, sea, and road routes including:
  - Karachi → Jebel Ali (sea) → Riyadh (road) — MSC-MIX-1
  - Karachi → Jebel Ali (sea) → Dammam (sea) — MAERSK-SEA-1
  - Karachi → Dubai (air) → Riyadh (air) — EMSKY-AIR-1
  - Dubai → Riyadh (road) — ARAMEX-ROAD-1, DHL-MIX-1
  - and more

### Available npm scripts

**Backend** (`cd backend`):

| Script          | Description                                     |
| --------------- | ----------------------------------------------- |
| `npm run dev`   | Start dev server with hot-reload (ts-node-dev)  |
| `npm run build` | Compile TypeScript to `dist/`                   |
| `npm run start` | Run compiled build (`dist/server.js`)           |
| `npm run seed`  | Populate MongoDB with carrier data (idempotent) |

**Frontend** (`cd frontend`):

| Script          | Description                        |
| --------------- | ---------------------------------- |
| `npm run dev`   | Start Vite dev server on port 5173 |
| `npm run build` | Production bundle to `dist/`       |

**Root** (`cd task`):

| Script                | Description            |
| --------------------- | ---------------------- |
| `npm run docker:up`   | `docker compose up -d` |
| `npm run docker:down` | `docker compose down`  |
| `npm run docker:logs` | Tail container logs    |

---

## Environment Variables

### Backend (`backend/.env`)

```env
# MongoDB connection — replica set required for multi-document transactions
MONGO_URI=mongodb://127.0.0.1:27017/logistics?replicaSet=rs0

PORT=4000

# Allowed CORS origin (use * for local dev)
CORS_ORIGIN=http://localhost:5173

NODE_ENV=development
```

### Frontend (`frontend/.env`)

```env
# Leave empty to use the Vite proxy (/api → localhost:4000)
# Set this for production deployments pointing to a remote API
VITE_API_URL=
```

---

## Design Trade-offs & Assumptions

- **Single database, logical service boundaries**: Both the Carrier Catalogue and Shipment services share one MongoDB database. This keeps deployment simple while maintaining clear module ownership and separation of concerns in the codebase. In a production microservices context, they could be split into separate services and databases.

- **Static base pricing**: `CarrierService.basePrice` is a fixed value. Real-world logistics platforms typically apply dynamic surcharges, fuel levies, and volume discounts. Those can be layered on top without restructuring the shipment schema, since the snapshot captures final pricing regardless of how it was computed.

- **Optimistic locking scope**: Concurrency control applies only to draft header updates. Leg operations do not carry a version check — this is acceptable because leg modifications in practice are sequential user actions, not concurrent background processes.

- **Idempotency key ownership**: The client generates and owns the `Idempotency-Key`. This is simpler than server-managed keys and consistent with industry standards (Stripe, Adyen). The frontend holds the key in a `useRef` so it persists across React re-renders and network retries without causing re-generation.

- **`shortId` for draft searchability**: MongoDB `ObjectId`s are not user-friendly. A `shortId` (last 6 hex chars of the `_id`, uppercased) is stored on creation, enabling draft shipments to be searched and identified before a formal shipment number is assigned at booking.

- **`toJSON` transform**: A global Mongoose `toJSON` transform maps `_id → id` (string) and strips `__v` from all API responses, giving the frontend a consistent `id` field across all entities.

---

## Known Limitations

- **Carrier management UI**: Adding or editing carriers and carrier services is not exposed in the UI. Data is managed via the seed script or directly in MongoDB.
- **Authentication/authorisation**: There is no auth layer. All endpoints are publicly accessible. Adding JWT-based auth would be the natural next step for a production deployment.
- **Exception resolution UI**: The tracking timeline shows exceptions and their resolution, but the UI does not yet expose a form to trigger exception creation or resolution — those are API-only operations.
- **Leg reordering**: Legs are ordered by `sequence`. The UI assigns sequences incrementally; there is no drag-to-reorder capability.
- **Pagination UI**: The backend supports `page`/`pageSize` on all list endpoints, but the frontend currently fetches the first page only and does not render a paginator.
