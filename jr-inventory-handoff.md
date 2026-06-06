# J&R Inventory System — Context Handoff

## 📌 System Overview
The **J&R Inventory System** is a bespoke inventory management platform designed for a high-volume clothing business operating on Shopee. It serves as the **single source of truth** for stock levels, countering the unreliability of Shopee's built-in tools, especially during high-intensity "Live Selling" sessions.

### Key Users
- **Owner**: Manages product listings, pricing strategy, and high-level analytics.
- **Partner**: Handles real-time stock-out entries during live sessions and manages restock intake.

---

## 🚀 Tech Stack
| Layer | Technology | Rationale |
|---|---|---|
| **Framework** | **Next.js 16 (App Router)** | State-of-the-art React framework with Server Components. |
| **Styling** | **Tailwind CSS 4** | Ultra-fast, modern utility-first CSS. |
| **Database** | **PostgreSQL** | Robust relational data for complex inventory queries. |
| **ORM** | **Prisma** | Type-safe database access and migrations. |
| **Data Fetching** | **TanStack Query v5** | Efficient client-side caching and synchronization. |
| **Validation** | **Zod** | End-to-end type safety and schema validation. |
| **Analytics** | **Recharts** | Interactive visualization of revenue, profit, and stock trends. |
| **PWA** | **Serwist** | Enables offline usage and mobile "app-like" experience. |
| **UI Library** | **shadcn/ui** | Accessible, premium-feeling components. |

---

## 👗 Data Model Highlights
The system tracks inventory at the **Variant Level** (Size/Color/Fabric combination).

- **Product**: Parent entity (e.g., "Ribbed Tank Top").
- **ProductVariant**: The stockable unit. Includes:
    - `costPrice`: Supplier cost.
    - `price`: Standard selling price.
    - `salePrice`: Promotional price used during live sessions.
    - `currentStock` & `lowStockAt`: Inventory monitoring.
- **StockMovement**: Audit trail of every `IN`, `OUT`, and `ADJUSTMENT`.
    - **Crucial**: Captures `priceAtMovement` to ensure historical profit accuracy even if prices change later.

---

## ⚡ Core Business Workflows

### 1. Live Selling Mode (The "Heart" of the System)
During live streams, the system is used for **rapid entry**.
- **Live Sale Logic**: Sales can be recorded at `Standard Price` or `Sale Price`.
- **Real-time Validation**: Prevents overselling (stock cannot go negative).
- **Fast Search**: Optimized comboboxes for finding variants by SKU or name in seconds.

### 2. Restocking & Adjustment
- Bulk `IN` movements when new inventory arrives from suppliers.
- `ADJUSTMENT` type for reconciling physical stock counts without affecting sales history.

### 3. Analytics & Reporting
- **Performance Tracking**: Revenue and profit calculated in real-time.
- **Breakthrough Detection**: Visualizing sales trends via Recharts.
- **Excel Export**: Generate `.xlsx` reports for Shopee reconciliation.

---

## 🛠️ Internal Architecture Patterns

### Robust API Wrapper (`lib/api-wrapper.ts`)
All API routes are wrapped in a custom handler that:
- Standardizes error responses (via `ApiError` class).
- Automates Zod schema validation.
- Handles Prisma transaction errors (like 409 Conflicts).

### Type-Safe Forms
Components like `VariantForm` and `StockMovementForm` use Zod schemas shared between client and server, ensuring zero data integrity issues.

---

## 📦 Deployment & Setup
The project is fully **Dockerized** for consistent environment management.

- **Local Dev**: `npm run dev`
- **Docker Build**: `docker compose up --build`
- **Database**: Managed via Prisma (`npx prisma migrate dev`)

---

## ✅ Current Project Status
- [x] **Live Selling Pricing**: Support for `salePrice` and historical price tracking.
- [x] **Analytics Dashboard**: Revenue and profit charts integrated.
- [x] **PWA Support**: Installable on mobile devices.
- [x] **Containerization**: Docker configuration complete.
- [x] **Robust Validation**: Zod schemas applied to all critical endpoints.

### 💡 What's Next?
1. **Multi-User Sync**: Fine-tuning real-time updates for concurrent users.
2. **Shopee API Integration**: Automating stock-out movements via webhooks.
3. **Advanced Reporting**: Period-over-period growth comparisons.
