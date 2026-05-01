import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import * as XLSX from "xlsx";
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/export — export current stock as Excel (.xlsx)
export const GET = withErrorHandler(async () => {
  // Fetch all variants with their product and category info
  const variants = await db.productVariant.findMany({
    include: {
      product: {
        include: { category: true },
      },
    },
    orderBy: { product: { name: "asc" } },
  });

  // Transform data for Excel export
  const rows = variants.map((v) => ({
    "Product Name": v.product.name,
    "SKU": v.sku ?? "",
    "Size": v.size ?? "",
    "Color": v.color ?? "",
    "Fabric": v.fabric ?? "",
    "Price": Number(v.price),
    "Sale Price": v.salePrice ? Number(v.salePrice) : "",
    "Current Stock": v.currentStock,
    "Low Stock At": v.lowStockAt,
    "Category": v.product.category?.name ?? "Uncategorized",
  }));

  // Create workbook and worksheet
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Stock Report");

  // Set column widths
  const colWidths = [
    { wch: 30 }, // Product Name
    { wch: 15 }, // SKU
    { wch: 10 }, // Size
    { wch: 12 }, // Color
    { wch: 12 }, // Fabric
    { wch: 10 }, // Price
    { wch: 14 }, // Current Stock
    { wch: 12 }, // Low Stock At
    { wch: 20 }, // Category
  ];
  worksheet["!cols"] = colWidths;

  // Generate buffer
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  // Return as downloadable file
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="stock-report-${new Date().toISOString().split("T")[0]}.xlsx"`,
    },
  });
});
