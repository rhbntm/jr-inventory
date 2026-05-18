# J&R Inventory System

An inventory management platform I specifically made for my friend's clothing business for high-volume clothing sales on Shopee. Serves as the single source of truth for stock levels, with real-time tracking during live selling sessions, restock management, and profit analytics.

## Features

- **Live Selling Mode** – Rapid stock-out entry during live streams with sale price support
- **Variant-Level Tracking** – Manage stock by Size/Color/Fabric combinations (SKU-based)
- **Stock Movements** – Full audit trail of IN/OUT/ADJUSTMENT transactions with historical price tracking
- **Analytics Dashboard** – Revenue, profit, and stock trend visualization
- **PWA Support** – Offline-capable, installable on mobile devices
- **Excel Export** – Generate reports for Shopee reconciliation

## Tech Stack

- **Next.js 16** (App Router)
- **PostgreSQL** + **Prisma** ORM
- **Tailwind CSS 4** + **shadcn/ui**
- **TanStack Query** + **Zod** validation
- **Docker** + **Serwist** (PWA)

## Getting Started

```bash
npm run dev        # Local development
docker compose up  # Docker deployment