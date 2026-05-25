-- AlterTable
ALTER TABLE "product_variants" ADD COLUMN     "damageNote" TEXT,
ADD COLUMN     "damaged" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "stock_movements" ADD COLUMN     "costPriceAtMovement" DECIMAL(10,2);

-- CreateTable
CREATE TABLE "batches" (
    "id" TEXT NOT NULL,
    "supplierName" TEXT,
    "purchaseDate" TIMESTAMP(3),
    "totalCost" DECIMAL(10,2),
    "estimatedQty" INTEGER,
    "actualQty" INTEGER,
    "damagedQty" INTEGER DEFAULT 0,
    "category" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "batch_movements" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "costPerUnit" DECIMAL(10,2),

    CONSTRAINT "batch_movements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "batch_movements_batchId_idx" ON "batch_movements"("batchId");

-- CreateIndex
CREATE INDEX "batch_movements_variantId_idx" ON "batch_movements"("variantId");

-- CreateIndex
CREATE INDEX "stock_movements_variantId_type_createdAt_idx" ON "stock_movements"("variantId", "type", "createdAt");

-- AddForeignKey
ALTER TABLE "batch_movements" ADD CONSTRAINT "batch_movements_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batch_movements" ADD CONSTRAINT "batch_movements_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
