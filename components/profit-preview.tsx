"use client";

interface ProfitPreviewProps {
  price: number;
  costPrice: number;
  salePrice?: number | null;
}

export function ProfitPreview({ price, costPrice, salePrice }: ProfitPreviewProps) {
  const hasNoPrice = price <= 0 && (!salePrice || salePrice <= 0);
  if (hasNoPrice) return null;

  const normalProfit = price - costPrice;
  const normalMargin = price > 0 ? (normalProfit / price) * 100 : 0;

  const isSaleActive = salePrice !== null && salePrice !== undefined && salePrice > 0;
  const saleProfit = isSaleActive ? salePrice - costPrice : 0;
  const saleMargin = isSaleActive && salePrice > 0 ? (saleProfit / salePrice) * 100 : 0;

  return (
    <div className="p-3 bg-muted rounded-md text-sm space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-muted-foreground font-medium">Standard Profit:</span>
        <span className={normalProfit >= 0 ? "text-green-600 font-bold" : "text-destructive font-bold"}>
          ₱{normalProfit.toFixed(2)}
          <span className="text-xs ml-1 font-normal">
            ({normalMargin.toFixed(1)}%)
          </span>
        </span>
      </div>

      {isSaleActive && (
        <div className="flex justify-between items-center pt-2 border-t border-muted-foreground/20">
          <span className="text-amber-600 font-medium">Sale Profit:</span>
          <span className={saleProfit >= 0 ? "text-amber-600 font-bold" : "text-destructive font-bold"}>
            ₱{saleProfit.toFixed(2)}
            <span className="text-xs ml-1 font-normal">
              ({saleMargin.toFixed(1)}%)
            </span>
          </span>
        </div>
      )}
    </div>
  );
}
