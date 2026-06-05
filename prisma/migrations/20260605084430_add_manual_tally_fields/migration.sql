-- AlterTable
ALTER TABLE "batches" ADD COLUMN     "stainedQty" INTEGER DEFAULT 0;

-- AlterTable
ALTER TABLE "product_variants" ADD COLUMN     "damagedStock" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "stainedStock" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "settings" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("key")
);
