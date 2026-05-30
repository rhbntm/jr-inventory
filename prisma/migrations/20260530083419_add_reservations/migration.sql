-- CreateEnum
CREATE TYPE "ReservationState" AS ENUM ('RESERVED', 'SHIPPING', 'SHIPPED', 'RELEASED', 'RETURNED', 'CANCELLED');

-- AlterTable
ALTER TABLE "product_variants" ADD COLUMN     "reservedStock" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "reservations" (
    "id" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "state" "ReservationState" NOT NULL DEFAULT 'RESERVED',
    "customerName" TEXT,
    "reservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "shippingAt" TIMESTAMP(3),
    "shippedAt" TIMESTAMP(3),
    "releasedAt" TIMESTAMP(3),
    "returnedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "updatedBy" TEXT,

    CONSTRAINT "reservations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reservations_variantId_idx" ON "reservations"("variantId");

-- CreateIndex
CREATE INDEX "reservations_state_idx" ON "reservations"("state");

-- CreateIndex
CREATE INDEX "reservations_reservedAt_idx" ON "reservations"("reservedAt");

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
