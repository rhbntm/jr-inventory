# J&R Inventory — Domain Glossary (CONTEXT.md)

This file is the canonical vocabulary for the J&R Inventory System. Architecture discussions
and code review should use these terms precisely.

---

## Core Entities

**Product**
A named clothing article (e.g., "Ribbed Tank Top"). The parent of one or more Variants.
Products belong to a Category.

**Variant** (also: ProductVariant, SKU)
The stockable unit. Each Variant belongs to exactly one Product and is distinguished by
`size`, `color`, and/or `fabric`. Variants carry their own pricing (`costPrice`, `price`,
`salePrice`) and stock counters.

**Category**
A coarse classification applied to Products (e.g., Ukay-ukay, RTW, Kids).

---

## Stock Lifecycle

**StockMovement**
An immutable audit-log entry recording a change to a Variant's `currentStock`.
Three types:
- **IN** — stock added (restock, batch processing, return).
- **OUT** — stock removed (sale, live-sell dispatch).
- **ADJUSTMENT** — stock set directly (reconciliation, condition reclassification).

`priceAtMovement` and `costPriceAtMovement` are captured at write time so that
historical profit calculations remain accurate even after prices change.

**currentStock**
The total physical-in-hand quantity of a Variant, regardless of reservations.

**reservedStock**
Quantity locked for active Reservations. Deducted from `currentStock` to compute
Available Stock.

**Available Stock**
`currentStock − reservedStock`. The quantity that can be sold or reserved right now.

**Condition buckets** (`stainedStock`, `damagedStock`)
Sub-counts of unsellable physical stock. Incremented via a Condition Adjustment
(an ADJUSTMENT StockMovement). Not counted in `currentStock` — they live alongside it.

---

## Batch Intake

**Batch**
Represents one delivery of a ukay/RTW bale from a supplier. A Batch has:
- Header info: supplier, date, cost, category.
- Quantity estimates: `estimatedQty`, `actualQty`, `damagedQty`, `stainedQty`.

**Weighing Estimate**
The formula used to approximate Batch quantity without counting:
`weightPerUnit = sampleWeight / sampleQty`
`estimatedTotalQty = floor(totalWeight / weightPerUnit)`

**BatchMovement** (line item)
A Batch-to-Variant allocation: how many units from this Batch went to which Variant.
Distinct from StockMovement — a BatchMovement records the allocation; a StockMovement
records the stock change in the ledger.

**Batch processing** (`processBatch`)
The act of finalising a Batch: creating BatchMovements, creating IN StockMovements,
and incrementing `currentStock` for each assigned Variant — all in one transaction.

**Batch reprocessing** (`reprocessBatch`)
Reversing and replacing a processed Batch. Reversal creates OUT StockMovements
(audit trail), then new BatchMovements and IN StockMovements are applied.

**Manual Batch**
A simplified intake path that creates a Batch, optionally creates a new Product/Variant,
and immediately records a Tally (good / stained / damaged counts) in a single operation.

**Tally**
The count breakdown in a Manual Batch: `good`, `stained`, `damaged` units.

**Sellable Quantity**
The count of units from a Batch that bear the purchase cost: `good + stained`.
Damaged units are pure loss and are excluded from cost allocation.
In the wizard Batch flow, damaged units are tracked in `damagedQty` on the Batch header
and are not assigned to any Variant, so `assignedQty` is already the Sellable Quantity.

**Cost-per-unit resolution** (canonical rule, implemented in `resolveCostPerUnit`)
Three-tier precedence:
1. **Explicit override** — `costPerUnit` provided per BatchMovement assignment (user-entered).
2. **Auto from batch** — `totalCost / sellableQty`, when both are > 0.
3. **Unknown** — returns `null`. Stored as `null` in `BatchMovement.costPerUnit` and
   `StockMovement.costPriceAtMovement`. Does NOT fall back to the Variant's stored
   `costPrice` — that would silently corrupt profit calculations with a stale price from
   a different Batch.

---

## Live Selling

**Live Sale**
A real-time OUT movement recorded during a Shopee live stream. Uses `salePrice`
(if set) as `priceAtMovement` rather than the standard `price`.

---

## Reservations

**Reservation**
A quantity of a Variant held for a named customer. Increments `reservedStock`,
reducing Available Stock without reducing `currentStock`.

**Reservation state machine**
`RESERVED → SHIPPING → SHIPPED` (happy path, with stock deducted on SHIPPED)
`RESERVED | SHIPPING → RELEASED` (released back without deducting stock)
`RESERVED | SHIPPING → CANCELLED` (same as release, restores `reservedStock`)
`SHIPPED → RETURNED` (optionally restocks via an IN StockMovement)

---

## Analytics

**Dashboard Stats**
Aggregated KPIs shown on the dashboard: today's revenue/profit, low-stock count,
movement trends (7-day), margin distribution, top performers, slow-moving items.

**Batch Analytics**
Two ranked lists derived from processed Batches: top 5 by estimated profit, and
top 5 by damage rate.

**Damage Rate**
`damagedQty / actualQty`, expressed as a percentage. Alerts shown when > 20%.

---

## Markup / Settings

**Markup Settings**
System-wide price calculation aids: `markupPercent` and `fixedMarkup`. Used in
the ProfitPreview component when creating or editing Variants.

---

## Technical Concepts (not domain, but referenced in architecture)

**Repository** (`*Repo`)
A static-method class that owns all Prisma access for one domain entity.
The API route delegates to the Repository.

**API Wrapper** (`withErrorHandler`, `parseBody`)
Thin Next.js middleware that standardises error responses and Zod validation.
