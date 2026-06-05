"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useCreateManualBatch, useProducts, useMarkupSettings } from "@/lib/hooks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CheckCircle,
  ChevronRight,
  ChevronLeft,
  Package,
  ListTodo,
  Minus,
  Plus,
  Loader2,
  Tag
} from "lucide-react";
import type { ManualBatchInput } from "@/lib/schemas";

// ─── Types ────────────────────────────────────────────────────────────────────

type HeaderData = {
  supplierName: string;
  purchaseDate: string;
  totalCost: string;
  category: string;
  notes: string;
  estimatedQty: string;
};

type VariantData = {
  mode: "EXISTING" | "NEW";
  existingId: string;
  productName: string;
  sku: string;
  size: string;
  color: string;
  fabric: string;
  price: string;
};

type TallyData = {
  good: number;
  stained: number;
  damaged: number;
};

// ─── Step indicators ──────────────────────────────────────────────────────────

const STEPS = [
  { label: "Batch Details", icon: Package },
  { label: "Variant", icon: Tag },
  { label: "Live Tally", icon: ListTodo },
  { label: "Review", icon: CheckCircle },
] as const;

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-0 mb-8 w-full overflow-x-auto">
      {STEPS.map((step, i) => {
        const Icon = step.icon;
        const done = i < current;
        const active = i === current;
        return (
          <div key={i} className="flex items-center flex-shrink-0">
            <div
              className={`flex items-center gap-2 px-3 py-2 rounded-full text-xs font-medium transition-all
                ${active ? "bg-primary text-primary-foreground shadow-md" : ""}
                ${done ? "text-primary" : "text-muted-foreground"}
              `}
            >
              {done ? (
                <CheckCircle className="h-4 w-4 text-primary" />
              ) : (
                <Icon className={`h-4 w-4 ${active ? "text-primary-foreground" : ""}`} />
              )}
              <span className="hidden sm:inline">{step.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`h-px w-6 md:w-10 mx-1 ${done ? "bg-primary" : "bg-border"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Step 1: Batch Details ────────────────────────────────────────────────────

function Step1Details({
  data,
  onChange,
  onNext,
}: {
  data: HeaderData;
  onChange: (d: Partial<HeaderData>) => void;
  onNext: () => void;
}) {
  const isComplete = data.totalCost !== "" && data.estimatedQty !== "";

  return (
    <div className="space-y-5">
      <div>
        <Label htmlFor="supplierName">Supplier Name</Label>
        <Input
          id="supplierName"
          placeholder="e.g. Divisoria Wholesale"
          value={data.supplierName}
          onChange={(e) => onChange({ supplierName: e.target.value })}
          className="mt-1"
        />
      </div>
      <div>
        <Label htmlFor="purchaseDate">Purchase Date</Label>
        <Input
          id="purchaseDate"
          type="date"
          value={data.purchaseDate}
          onChange={(e) => onChange({ purchaseDate: e.target.value })}
          className="mt-1"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="totalCost">Total Cost (₱) <span className="text-destructive">*</span></Label>
          <Input
            id="totalCost"
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={data.totalCost}
            onChange={(e) => onChange({ totalCost: e.target.value })}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="estimatedQty">Estimated Quantity <span className="text-destructive">*</span></Label>
          <Input
            id="estimatedQty"
            type="number"
            min="1"
            step="1"
            placeholder="e.g. 100"
            value={data.estimatedQty}
            onChange={(e) => onChange({ estimatedQty: e.target.value })}
            className="mt-1"
          />
        </div>
      </div>
      <div>
        <Label htmlFor="category">Category / Tag</Label>
        <Input
          id="category"
          placeholder="e.g. Ukay, RTW, Kids"
          value={data.category}
          onChange={(e) => onChange({ category: e.target.value })}
          className="mt-1"
        />
      </div>
      <div>
        <Label htmlFor="notes">Notes</Label>
        <textarea
          id="notes"
          rows={3}
          placeholder="Any additional notes about this batch..."
          value={data.notes}
          onChange={(e) => onChange({ notes: e.target.value })}
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
      <div className="flex justify-end pt-2">
        <Button id="step1-next" onClick={onNext} disabled={!isComplete}>
          Next <ChevronRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ─── Step 2: Variant Selection ────────────────────────────────────────────────

function Step2Variant({
  data,
  headerData,
  onChange,
  onNext,
  onBack,
}: {
  data: VariantData;
  headerData: HeaderData;
  onChange: (d: Partial<VariantData>) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const { data: productsData, isLoading } = useProducts({ pageSize: 100 });
  const { data: settingsData } = useMarkupSettings();
  const [search, setSearch] = useState("");

  const allVariants = useMemo(() => {
    return (productsData?.data ?? []).flatMap((p) =>
      p.variants.map((v) => ({ ...v, productName: p.name }))
    );
  }, [productsData]);

  const filteredVariants = useMemo(() => {
    const q = search.toLowerCase();
    return allVariants.filter((v) =>
      v.productName.toLowerCase().includes(q) ||
      (v.sku ?? "").toLowerCase().includes(q) ||
      (v.size ?? "").toLowerCase().includes(q) ||
      (v.color ?? "").toLowerCase().includes(q)
    );
  }, [allVariants, search]);

  // Preview pricing for NEW mode
  const estQty = Number(headerData.estimatedQty) || 1;
  const totalCost = Number(headerData.totalCost) || 0;
  const estCostPerUnit = totalCost / estQty;
  const defaultMarkupPct = settingsData?.markupPercent ?? 25;
  const defaultFixedMarkup = settingsData?.fixedMarkup ?? 5;

  const suggestedPrice = useMemo(() => {
    return (estCostPerUnit * (1 + defaultMarkupPct / 100)) + defaultFixedMarkup;
  }, [estCostPerUnit, defaultMarkupPct, defaultFixedMarkup]);

  // Auto-fill price when switching to NEW mode
  useEffect(() => {
    if (data.mode === "NEW" && data.price === "" && suggestedPrice > 0) {
      onChange({ price: suggestedPrice.toFixed(2) });
    }
  }, [data.mode, suggestedPrice, data.price, onChange]);

  const isComplete = data.mode === "EXISTING"
    ? !!data.existingId
    : !!data.productName;

  return (
    <div className="space-y-6">
      <div className="flex gap-4 p-1 border rounded-lg bg-muted/20 w-fit">
        <Button
          type="button"
          variant={data.mode === "EXISTING" ? "default" : "ghost"}
          onClick={() => onChange({ mode: "EXISTING" })}
          className="rounded-md"
        >
          Existing Variant
        </Button>
        <Button
          type="button"
          variant={data.mode === "NEW" ? "default" : "ghost"}
          onClick={() => onChange({ mode: "NEW" })}
          className="rounded-md"
        >
          Create New Variant
        </Button>
      </div>

      {data.mode === "EXISTING" ? (
        <div className="space-y-4">
          <Input
            id="variant-search"
            placeholder="Search variants..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : (
            <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
              {filteredVariants.map((v) => {
                const selected = data.existingId === v.id;
                return (
                  <div
                    key={v.id}
                    onClick={() => onChange({ existingId: v.id })}
                    className={`cursor-pointer rounded-lg border p-3 transition-colors ${
                      selected ? "border-primary bg-primary/5 shadow-sm" : "hover:bg-accent"
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-medium text-sm">{v.productName}</p>
                        <div className="flex gap-2 text-xs text-muted-foreground">
                          {v.sku && <span>{v.sku}</span>}
                          {v.size && <span>{v.size}</span>}
                          {v.color && <span>{v.color}</span>}
                        </div>
                      </div>
                      {selected && <CheckCircle className="h-5 w-5 text-primary" />}
                    </div>
                  </div>
                );
              })}
              {filteredVariants.length === 0 && (
                <p className="text-center text-muted-foreground text-sm py-8">No variants found.</p>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4 border p-4 rounded-lg bg-card">
          <div>
            <Label htmlFor="productName">Product Name <span className="text-destructive">*</span></Label>
            <Input
              id="productName"
              placeholder="e.g. Vintage Denim Jacket"
              value={data.productName}
              onChange={(e) => onChange({ productName: e.target.value })}
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">If a product with this exact name exists, the variant will be added to it.</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="sku">SKU (Optional)</Label>
              <Input
                id="sku"
                value={data.sku}
                onChange={(e) => onChange({ sku: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="size">Size</Label>
              <select
                id="size"
                value={data.size}
                onChange={(e) => onChange({ size: e.target.value })}
                className="mt-1 flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">Select size...</option>
                <option value="XS">XS</option>
                <option value="S">S</option>
                <option value="M">M</option>
                <option value="L">L</option>
                <option value="XL">XL</option>
                <option value="XXL">XXL</option>
                <option value="Free Size">Free Size</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <Label htmlFor="color">Color</Label>
              <Input
                id="color"
                value={data.color}
                onChange={(e) => onChange({ color: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="fabric">Fabric</Label>
              <Input
                id="fabric"
                value={data.fabric}
                onChange={(e) => onChange({ fabric: e.target.value })}
                className="mt-1"
              />
            </div>
          </div>
          <div className="pt-2 border-t mt-4">
            <Label htmlFor="price">Selling Price (₱)</Label>
            <div className="flex items-center gap-3 mt-1">
              <Input
                id="price"
                type="number"
                step="0.01"
                min="0"
                value={data.price}
                onChange={(e) => onChange({ price: e.target.value })}
                className="max-w-[150px]"
              />
              <div className="text-xs text-muted-foreground">
                <p>Est. Cost/Unit: ₱{estCostPerUnit.toFixed(2)}</p>
                <p>Suggested (from settings): ₱{suggestedPrice.toFixed(2)}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between pt-4">
        <Button id="step2-back" variant="outline" onClick={onBack}>
          <ChevronLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <Button id="step2-next" onClick={onNext} disabled={!isComplete}>
          Next <ChevronRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ─── Step 3: Live Tally ───────────────────────────────────────────────────────

function Counter({
  label,
  value,
  onChange,
  colorClass,
}: {
  label: string;
  value: number;
  onChange: (newVal: number) => void;
  colorClass: string;
}) {
  return (
    <div className={`flex flex-col items-center p-6 rounded-xl border-2 ${colorClass} bg-card/50`}>
      <h3 className="font-semibold mb-4 text-lg">{label}</h3>
      <div className="flex items-center justify-center gap-4">
        <Button
          variant="outline"
          size="icon"
          className="h-12 w-12 rounded-full"
          onClick={() => onChange(Math.max(0, value - 1))}
          disabled={value <= 0}
        >
          <Minus className="h-6 w-6" />
        </Button>
        <div className="w-20 text-center text-4xl font-bold tabular-nums">
          {value}
        </div>
        <Button
          variant="outline"
          size="icon"
          className="h-12 w-12 rounded-full"
          onClick={() => onChange(value + 1)}
        >
          <Plus className="h-6 w-6" />
        </Button>
      </div>
    </div>
  );
}

function Step3Tally({
  tally,
  estimatedQty,
  onChange,
  onNext,
  onBack,
}: {
  tally: TallyData;
  estimatedQty: number;
  onChange: (d: Partial<TallyData>) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const totalCounted = tally.good + tally.stained + tally.damaged;
  const remaining = estimatedQty - totalCounted;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Counter
          label="Good"
          value={tally.good}
          onChange={(v) => onChange({ good: v })}
          colorClass="border-green-500/50 hover:border-green-500 shadow-sm"
        />
        <Counter
          label="Stained"
          value={tally.stained}
          onChange={(v) => onChange({ stained: v })}
          colorClass="border-amber-500/50 hover:border-amber-500 shadow-sm"
        />
        <Counter
          label="Damaged"
          value={tally.damaged}
          onChange={(v) => onChange({ damaged: v })}
          colorClass="border-destructive/50 hover:border-destructive shadow-sm"
        />
      </div>

      <div className={`p-4 rounded-lg border flex items-center justify-between ${remaining < 0 ? "bg-amber-500/10 border-amber-500/50 text-amber-600" : "bg-muted/50"}`}>
        <div>
          <p className="font-medium">Total Counted: {totalCounted}</p>
          <p className="text-sm opacity-80">Estimated: {estimatedQty}</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold">{Math.abs(remaining)}</p>
          <p className="text-xs font-medium uppercase tracking-wider">{remaining < 0 ? "OVER ESTIMATE" : "REMAINING"}</p>
        </div>
      </div>

      <div className="flex justify-between pt-4">
        <Button id="step3-back" variant="outline" onClick={onBack}>
          <ChevronLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => onChange({ good: 0, stained: 0, damaged: 0 })}>
            Reset
          </Button>
          <Button id="step3-next" onClick={onNext} disabled={totalCounted === 0}>
            Review <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Step 4: Review ───────────────────────────────────────────────────────────

function Step4Review({
  header,
  variant,
  tally,
  isSubmitting,
  onSubmit,
  onBack,
}: {
  header: HeaderData;
  variant: VariantData;
  tally: TallyData;
  isSubmitting: boolean;
  onSubmit: () => void;
  onBack: () => void;
}) {
  const { data: productsData } = useProducts({ pageSize: 100 });
  const allVariants = useMemo(() => {
    return (productsData?.data ?? []).flatMap((p) =>
      p.variants.map((v) => ({ ...v, productName: p.name }))
    );
  }, [productsData]);

  const existingVariant = variant.mode === "EXISTING" 
    ? allVariants.find(v => v.id === variant.existingId)
    : null;

  const totalCounted = tally.good + tally.stained + tally.damaged;
  const goodAndStainedQty = tally.good + tally.stained;
  const totalCost = Number(header.totalCost) || 0;
  const costPerUnit = goodAndStainedQty > 0 ? totalCost / goodAndStainedQty : 0;

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="shadow-none">
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-base">Batch Information</CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Supplier</span> <span className="font-medium">{header.supplierName || "—"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Date</span> <span className="font-medium">{header.purchaseDate || "—"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Category</span> <span className="font-medium">{header.category || "—"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Total Cost</span> <span className="font-medium">₱{totalCost.toFixed(2)}</span></div>
            <div className="flex justify-between pt-2 mt-2 border-t">
              <span className="font-medium">Calculated Cost/Unit</span> 
              <span className="font-bold text-primary">₱{costPerUnit.toFixed(2)}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">(Only Good & Stained items absorb the cost)</p>
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-base">Variant Details</CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-2 text-sm">
            {variant.mode === "EXISTING" && existingVariant ? (
              <>
                <Badge variant="secondary" className="mb-2">Existing Variant</Badge>
                <div className="flex justify-between"><span className="text-muted-foreground">Product</span> <span className="font-medium">{existingVariant.productName}</span></div>
                {existingVariant.sku && <div className="flex justify-between"><span className="text-muted-foreground">SKU</span> <span>{existingVariant.sku}</span></div>}
                <div className="flex justify-between"><span className="text-muted-foreground">Attributes</span> <span>{[existingVariant.size, existingVariant.color].filter(Boolean).join(" / ")}</span></div>
                <div className="flex justify-between pt-2 mt-2 border-t">
                  <span className="text-muted-foreground">Selling Price</span> 
                  <span>₱{Number(existingVariant.price).toFixed(2)}</span>
                </div>
              </>
            ) : (
              <>
                <Badge className="mb-2 bg-green-500 hover:bg-green-600">New Variant</Badge>
                <div className="flex justify-between"><span className="text-muted-foreground">Product</span> <span className="font-medium">{variant.productName}</span></div>
                {variant.sku && <div className="flex justify-between"><span className="text-muted-foreground">SKU</span> <span>{variant.sku}</span></div>}
                <div className="flex justify-between"><span className="text-muted-foreground">Attributes</span> <span>{[variant.size, variant.color, variant.fabric].filter(Boolean).join(" / ")}</span></div>
                <div className="flex justify-between pt-2 mt-2 border-t">
                  <span className="font-medium">Selling Price</span> 
                  <span className="font-bold">₱{Number(variant.price || 0).toFixed(2)}</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-none bg-muted/30">
        <CardContent className="p-4">
          <h3 className="font-medium mb-3">Tally Results ({totalCounted} total items)</h3>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-background rounded-md p-2 border">
              <p className="text-xs text-muted-foreground uppercase">Good</p>
              <p className="text-xl font-bold text-green-600">{tally.good}</p>
            </div>
            <div className="bg-background rounded-md p-2 border">
              <p className="text-xs text-muted-foreground uppercase">Stained</p>
              <p className="text-xl font-bold text-amber-500">{tally.stained}</p>
            </div>
            <div className="bg-background rounded-md p-2 border">
              <p className="text-xs text-muted-foreground uppercase">Damaged</p>
              <p className="text-xl font-bold text-destructive">{tally.damaged}</p>
            </div>
          </div>
          {header.notes && (
            <div className="mt-4 p-3 bg-background rounded-md text-sm text-muted-foreground border">
              <span className="font-medium text-foreground">Notes: </span>{header.notes}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-between pt-4">
        <Button id="step4-back" variant="outline" onClick={onBack} disabled={isSubmitting}>
          <ChevronLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <Button id="step4-submit" onClick={onSubmit} disabled={isSubmitting} className="min-w-32">
          {isSubmitting ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…</>
          ) : (
            <><CheckCircle className="mr-2 h-4 w-4" /> Save Batch</>
          )}
        </Button>
      </div>
    </div>
  );
}

// ─── Main Wizard ──────────────────────────────────────────────────────────────

export default function ManualBatchPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);

  const [header, setHeader] = useState<HeaderData>({
    supplierName: "",
    purchaseDate: new Date().toISOString().split('T')[0],
    totalCost: "",
    category: "",
    notes: "",
    estimatedQty: "",
  });

  const [variant, setVariant] = useState<VariantData>({
    mode: "EXISTING",
    existingId: "",
    productName: "",
    sku: "",
    size: "",
    color: "",
    fabric: "",
    price: "",
  });

  const [tally, setTally] = useState<TallyData>({
    good: 0,
    stained: 0,
    damaged: 0,
  });

  const createManualBatch = useCreateManualBatch();

  async function handleSubmit() {
    try {
      const payload: ManualBatchInput = {
        header: {
          supplierName: header.supplierName || null,
          purchaseDate: header.purchaseDate ? new Date(header.purchaseDate) : null,
          totalCost: Number(header.totalCost),
          estimatedQty: Number(header.estimatedQty),
          category: header.category || null,
          notes: header.notes || null,
        },
        variantMode: variant.mode,
        variant: variant.mode === "NEW" ? {
          productName: variant.productName,
          sku: variant.sku || null,
          size: variant.size || null,
          color: variant.color || null,
          fabric: variant.fabric || null,
          price: Number(variant.price) || null,
        } : {
          existingId: variant.existingId,
        },
        tally: {
          good: tally.good,
          stained: tally.stained,
          damaged: tally.damaged,
        }
      };

      await createManualBatch.mutateAsync(payload);
      toast.success("Manual batch saved successfully!");
      router.push("/batches");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to save manual batch");
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-3xl font-bold tracking-tight">Manual Tally Batch</h1>
        <Badge variant="outline">Step {step + 1} of {STEPS.length}</Badge>
      </div>

      <StepIndicator current={step} />

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            {(() => { const Icon = STEPS[step].icon; return <Icon className="h-5 w-5 text-primary" />; })()}
            {STEPS[step].label}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {step === 0 && (
            <Step1Details
              data={header}
              onChange={(d) => setHeader((h) => ({ ...h, ...d }))}
              onNext={() => setStep(1)}
            />
          )}
          {step === 1 && (
            <Step2Variant
              data={variant}
              headerData={header}
              onChange={(d) => setVariant((v) => ({ ...v, ...d }))}
              onNext={() => setStep(2)}
              onBack={() => setStep(0)}
            />
          )}
          {step === 2 && (
            <Step3Tally
              tally={tally}
              estimatedQty={Number(header.estimatedQty) || 0}
              onChange={(d) => setTally((t) => ({ ...t, ...d }))}
              onNext={() => setStep(3)}
              onBack={() => setStep(1)}
            />
          )}
          {step === 3 && (
            <Step4Review
              header={header}
              variant={variant}
              tally={tally}
              isSubmitting={createManualBatch.isPending}
              onSubmit={handleSubmit}
              onBack={() => setStep(2)}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
