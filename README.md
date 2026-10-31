# J&R Inventory System

An inventory management platform built for a friend's clothing business — specifically for high-volume clothing sales on Shopee. It serves as the single source of truth for stock levels, with real-time tracking during live selling sessions, ukay/RTW batch intake, reservation management, and profit analytics.

## Features

- **Live** — One screen for selling, reserving and receiving stock during Shopee live streams, using `salePrice` instead of the regular price when set, with undo for mistaken entries
- **Variant-Level Tracking** — SKU-based stock management by Size / Color / Fabric combinations
- **Batch Intake Wizard** — 5-step flow for receiving ukay/RTW bales: details → weighing estimate → damages → variant assignment → confirm
- **Stock Movements** — Immutable audit trail of `IN` / `OUT` / `ADJUSTMENT` transactions with price snapshot at movement time for accurate profit history
- **Reservations** — Customer hold system with full state machine (`RESERVED → SHIPPING → SHIPPED`, with `RELEASED`, `CANCELLED`, and `RETURNED` paths)
- **Analytics Dashboard** — Revenue, profit, stock trend visualization, top performers, slow movers, and batch damage rates
- **PWA Support** — Offline-capable, installable on mobile via Serwist (service worker)
- **Excel Export** — Generate reports for Shopee reconciliation
- **Role-Based Access** — `OWNER` and `PARTNER` roles with Google OAuth and email/password authentication

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.2 (App Router) |
| Database | PostgreSQL 17 + Prisma 7 ORM |
| Auth | NextAuth v4 (Google OAuth + credentials) |
| Styling | Tailwind CSS v4 + shadcn/ui (Base UI) |
| Data fetching | TanStack Query v5 |
| Validation | Zod v4 |
| Charts | Recharts |
| PWA | Serwist v9 |
| Testing | Vitest + Testing Library |
| Deployment | Docker + Tailscale Funnel |

## Project Structure

```
app/
├── api/              # API route handlers (products, variants, batches, movements, reservations, …)
├── batches/          # Batch intake wizard UI
├── dashboard/        # Today: what needs doing, stock value, recent activity
├── analytics/        # Detailed analytics pages
├── live/             # Sell, reserve and receive stock during a live session
├── movements/        # Stock movement log
├── products/         # Product & variant management
├── reservations/     # Reservation management
├── categories/       # Category management
├── settings/         # Markup & system settings
└── export/           # Excel report generation

components/           # Shared UI components (sidebar, forms, variant selector, …)
lib/                  # DB client, auth config, Zod schemas, hooks, API wrapper, rate limiter
prisma/               # schema.prisma + migrations
tests/                # Vitest unit tests (repositories, schemas, API wrapper)
docs/                 # Operational guides (bale counting, etc.)
```

## Getting Started

### Local Development

```bash
# 1. Install dependencies
npm install

# 2. Start a local Postgres instance (or use the dev compose file)
docker compose -f docker-compose.dev.yml up -d

# 3. Configure environment variables
cp .env.example .env   # fill in DATABASE_URL, NEXTAUTH_SECRET, Google OAuth credentials

# 4. Run migrations and generate Prisma client
npx prisma migrate deploy
npx prisma generate

# 5. Create the first OWNER user
npm run create-user -- --email you@example.com --name "Your Name" --role OWNER --password "<at least 8 chars>"

# 6. Start the dev server
npm run dev
```

### Docker Deployment

The production stack runs three containers: the Next.js app, PostgreSQL 17, and a Tailscale sidecar that exposes the app via Tailscale Funnel.

```bash
# Build and start all services
docker compose up -d

# View logs
docker compose logs -f app
```

Required env vars for Docker (set in `.env`):

| Variable | Description |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `NEXTAUTH_SECRET` | Random secret for NextAuth session signing |
| `NEXTAUTH_URL` | Public URL of the app (e.g. your Tailscale Funnel URL) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth credentials |
| `TS_AUTHKEY` | Tailscale reusable auth key |
| `TS_HOSTNAME` | Tailscale machine hostname |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | Database credentials |

## Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start Next.js development server |
| `npm run build` | Production build |
| `npm run start` | Serve production build |
| `npm run lint` | Run ESLint |
| `npm run test` | Run Vitest unit tests (needs a test database, see below) |
| `npm run test:ui` | Run Vitest with browser UI |
| `npm run create-user` | Create or invite a user (see below) |

### Users and Google sign-in

Google sign-in is **invite-only**: a Google account can sign in only if its email already exists in the users table.

Owners manage access in **Settings → Users**: invite someone by their Gmail address, change their role, or remove them. Removed users lose access on their next request; their past stock movements stay in the history.

From the command line (e.g. to create the first owner), create a user without a password to invite them for Google sign-in:

```bash
npm run create-user -- --email partner@gmail.com --name "Partner Name" --role PARTNER
```

Add `--password <password>` to allow email/password sign-in too, and `--update` to change an existing user.

### Tests

The test setup **deletes all data** in its database before and after each test. It reads `DATABASE_URL` from `.env.test` (not `.env`) and refuses to run unless the database name ends in `_test`.

```bash
cp .env.test.example .env.test
docker compose -f docker-compose.dev.yml exec db createdb -U postgres jr_inventory_test
DATABASE_URL="postgresql://postgres:postgres@localhost:5435/jr_inventory_test?schema=public" npx prisma migrate deploy
npm test
```

```bash
# Run manually
bash /home/brent/jr-inventory/backup-db.sh

# Schedule with cron (example: daily at 2 AM)
0 2 * * * /home/brent/jr-inventory/backup-db.sh

# Restore a backup
gunzip -c backups/<file>.sql.gz | \
  docker compose exec -T db psql -U postgres jr_inventory
```

## Key Domain Concepts

See [`CONTEXT.md`](./CONTEXT.md) for the full domain glossary. Key terms:

- **Product** → parent entity (e.g. "Ribbed Tank Top"), belongs to a Category
- **Variant / SKU** → stockable unit differentiated by size, color, fabric
- **StockMovement** → immutable ledger entry (`IN` / `OUT` / `ADJUSTMENT`), price-snapshotted at write time
- **Batch** → one supplier delivery; processed via the 5-step wizard to generate `IN` movements
- **Reservation** → customer hold on a variant quantity; reduces *available* stock without touching `currentStock`
- **Available Stock** = `currentStock − reservedStock`

## Documentation

- [`CONTEXT.md`](./CONTEXT.md) — Domain glossary and architecture reference
- [`docs/bale-counting-guide.md`](./docs/bale-counting-guide.md) — Step-by-step operator guide for receiving a ukay/RTW bale