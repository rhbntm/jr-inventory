"use client";

import { useState } from "react";
import { Droplets, Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import type { ProductVariant } from "@prisma/client";
import { useAdjustConditionStock } from "@/lib/hooks";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const toCount = (text: string) => Math.max(0, Number.parseInt(text, 10) || 0);

export function AdjustStockDialog({
  variant,
  open,
  onClose,
}: {
  variant: ProductVariant | null;
  open: boolean;
  onClose: () => void;
}) {
  const adjust = useAdjustConditionStock();
  // Null until edited, so the field always starts from the latest stock.
  const [onHandText, setOnHandText] = useState<string | null>(null);
  const [toStained, setToStained] = useState("");
  const [toDamaged, setToDamaged] = useState("");
  const [note, setNote] = useState("");

  if (!variant) return null;

  const { currentStock, reservedStock, stainedStock, damagedStock } = variant;
  const text = onHandText ?? String(currentStock);
  const parsed = Number.parseInt(text, 10);
  const validNumber = !Number.isNaN(parsed) && parsed >= 0;
  const onHand = validNumber ? parsed : currentStock;
  const change = onHand - currentStock;
  const stained = toCount(toStained);
  const damaged = toCount(toDamaged);
  const moved = stained + damaged;
  const onHandAfter = onHand - moved;
  const availableAfter = onHandAfter - reservedStock;

  const problem = !validNumber
    ? "Enter how many are on hand."
    : availableAfter < 0
      ? moved > 0
        ? `Only ${Math.max(0, onHand - reservedStock)} can be moved. The other ${reservedStock} are reserved.`
        : `Can't go below ${reservedStock}. Those are reserved. Release them first.`
      : null;
  const canSave = !problem && (change !== 0 || moved > 0) && !adjust.isPending;

  const setOnHand = (value: number) => setOnHandText(String(Math.max(0, value)));

  function handleClose() {
    setOnHandText(null);
    setToStained("");
    setToDamaged("");
    setNote("");
    onClose();
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSave) return;
    try {
      await adjust.mutateAsync({
        id: variant!.id,
        data: { stockChange: change, toStained: stained, toDamaged: damaged, note: note.trim() || null },
      });
      toast.success(`Stock updated. ${onHandAfter} on hand.`);
      handleClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update the stock");
    }
  }

  const changeText =
    change > 0 ? `Adding ${change}` : change < 0 ? `Removing ${-change}` : "No change yet";

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="max-w-md" showCloseButton={false}>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Adjust stock</DialogTitle>
            <DialogDescription>
              {[variant.sku, variant.size, variant.color].filter(Boolean).join(" · ") ||
                "Correct the count or move units. Corrections don't count as sales."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label htmlFor="adjust-on-hand">Good stock on hand</Label>
            <div className="flex gap-1.5">
              <button
                type="button"
                aria-label="One less"
                disabled={onHand <= 0}
                onClick={() => setOnHand(onHand - 1)}
                className="size-12 shrink-0 cursor-pointer rounded-lg border border-input bg-card text-xl hover:bg-background disabled:cursor-not-allowed disabled:opacity-40"
              >
                −
              </button>
              <Input
                id="adjust-on-hand"
                type="number"
                inputMode="numeric"
                min={0}
                value={text}
                onChange={(event) => setOnHandText(event.target.value)}
                aria-describedby="adjust-on-hand-help"
                className="h-12 flex-1 text-center text-xl font-bold tabular-nums md:text-xl"
              />
              <button
                type="button"
                aria-label="One more"
                onClick={() => setOnHand(onHand + 1)}
                className="size-12 shrink-0 cursor-pointer rounded-lg border border-input bg-card text-xl hover:bg-background"
              >
                +
              </button>
            </div>
            <p id="adjust-on-hand-help" className="text-[13px] text-muted-foreground tabular-nums">
              Was {currentStock}
              {reservedStock > 0 && `, ${reservedStock} reserved`}. {changeText}.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="adjust-stained" className="flex items-center gap-1.5">
                <Droplets className="size-4" aria-hidden="true" />
                Move to Stained
              </Label>
              <Input
                id="adjust-stained"
                type="number"
                inputMode="numeric"
                min={0}
                placeholder="0"
                value={toStained}
                onChange={(event) => setToStained(event.target.value)}
                className="h-11"
              />
              <p className="text-[13px] text-muted-foreground tabular-nums">{stainedStock} stained now</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="adjust-damaged" className="flex items-center gap-1.5">
                <ShieldAlert className="size-4" aria-hidden="true" />
                Move to Damaged
              </Label>
              <Input
                id="adjust-damaged"
                type="number"
                inputMode="numeric"
                min={0}
                placeholder="0"
                value={toDamaged}
                onChange={(event) => setToDamaged(event.target.value)}
                className="h-11"
              />
              <p className="text-[13px] text-muted-foreground tabular-nums">{damagedStock} damaged now</p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="adjust-note">Reason (optional)</Label>
            <Input
              id="adjust-note"
              placeholder="e.g. Recount, found in storage, lost"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              className="h-11"
            />
          </div>

          <p
            role={problem ? "alert" : undefined}
            className={problem ? "text-sm font-medium text-stock-out" : "text-sm font-medium tabular-nums"}
          >
            {problem ?? `After saving: ${onHandAfter} on hand, ${availableAfter} available to sell.`}
          </p>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="h-11 px-4"
              onClick={handleClose}
              disabled={adjust.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" className="h-11 px-4" disabled={!canSave}>
              {adjust.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Saving…
                </>
              ) : (
                "Save"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
