import { NextRequest, NextResponse } from "next/server";
import { db as prisma } from "@/lib/db";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const resolvedParams = await params;

    const reservation = await prisma.reservation.findUnique({
      where: { id: resolvedParams.id },
      include: {
        variant: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!reservation) {
      return new NextResponse("Reservation not found", { status: 404 });
    }

    // Try to find the associated StockMovement of type OUT
    const stockMovement = await prisma.stockMovement.findFirst({
      where: {
        variantId: reservation.variantId,
        type: "OUT",
        note: {
          contains: reservation.id,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (!stockMovement) {
      const fallbackHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Receipt Not Found</title>
          <style>
            body { font-family: sans-serif; padding: 20px; text-align: center; }
          </style>
        </head>
        <body>
          <h2>No sale record found. Please contact support.</h2>
        </body>
        </html>
      `;
      return new NextResponse(fallbackHtml, {
        headers: { "Content-Type": "text/html" },
      });
    }

    const customerName = reservation.customerName || "Walk-in Customer";
    const shortId = reservation.id.substring(0, 8);
    const date = reservation.shippedAt || reservation.reservedAt;
    const formattedDate = new Intl.DateTimeFormat("en-PH", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(date));

    const product = reservation.variant.product?.name || "Unknown Product";
    const variantDetails = [
      reservation.variant.size,
      reservation.variant.color,
      reservation.variant.sku,
    ]
      .filter(Boolean)
      .join(" / ");
      
    const quantity = reservation.quantity;
    const unitPrice = stockMovement?.priceAtMovement
      ? Number(stockMovement.priceAtMovement)
      : reservation.variant.salePrice 
        ? Number(reservation.variant.salePrice)
        : Number(reservation.variant.price);
    const totalAmount = quantity * unitPrice;

    const formatter = new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    });

    const prepaidNote = !stockMovement 
      ? `<p style="text-align: center; font-style: italic; color: #666; margin-bottom: 20px;">Payment collected online – receipt issued before shipment.</p>`
      : "";

    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Receipt - ${shortId}</title>
        <style>
          body {
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 40px 20px;
          }
          .header {
            text-align: center;
            margin-bottom: 40px;
          }
          .header h1 {
            margin: 0;
            font-size: 24px;
            color: #111;
          }
          .info {
            margin-bottom: 30px;
            font-size: 14px;
          }
          .info p {
            margin: 5px 0;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
          }
          th, td {
            padding: 12px 8px;
            border-bottom: 1px solid #eee;
            text-align: left;
          }
          th {
            font-weight: 600;
            color: #555;
            background-color: #fafafa;
          }
          .text-right {
            text-align: right;
          }
          .total-row td {
            font-weight: bold;
            font-size: 16px;
            border-bottom: none;
            padding-top: 20px;
          }
          .footer {
            text-align: center;
            margin-top: 50px;
            font-size: 14px;
            color: #666;
            border-top: 1px dashed #ccc;
            padding-top: 20px;
          }
          .actions {
            text-align: center;
            margin-top: 30px;
          }
          .btn {
            display: inline-block;
            padding: 8px 16px;
            background-color: #f3f4f6;
            color: #374151;
            text-decoration: none;
            border-radius: 4px;
            font-size: 14px;
            border: 1px solid #d1d5db;
            cursor: pointer;
          }
          .btn:hover {
            background-color: #e5e7eb;
          }
          @media print {
            body {
              padding: 0;
              max-width: 100%;
            }
            .actions {
              display: none;
            }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Receipt</h1>
        </div>

        <div class="info">
          <p><strong>Customer:</strong> ${customerName}</p>
          <p><strong>Receipt #:</strong> ${shortId}</p>
          <p><strong>Date:</strong> ${formattedDate}</p>
        </div>

        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th class="text-right">Qty</th>
              <th class="text-right">Price</th>
              <th class="text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <div><strong>${product}</strong></div>
                <div style="font-size: 12px; color: #666;">${variantDetails}</div>
              </td>
              <td class="text-right">${quantity}</td>
              <td class="text-right">${formatter.format(unitPrice)}</td>
              <td class="text-right">${formatter.format(totalAmount)}</td>
            </tr>
            <tr class="total-row">
              <td colspan="3" class="text-right">Total Amount:</td>
              <td class="text-right">${formatter.format(totalAmount)}</td>
            </tr>
          </tbody>
        </table>
        
        ${prepaidNote}

        <div class="footer">
          <p>Thank you for your purchase!</p>
        </div>

        <div class="actions">
          <button class="btn" onclick="window.close()">Close Receipt</button>
        </div>
        
        <script>
          window.onload = function() {
            setTimeout(() => {
              window.print();
            }, 500);
          }
        </script>
      </body>
      </html>
    `;

    return new NextResponse(html, {
      headers: { "Content-Type": "text/html" },
    });
  } catch (error) {
    console.error("Failed to generate receipt:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
