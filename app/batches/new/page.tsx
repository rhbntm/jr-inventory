"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  useCreateBatch,
  useProcessBatch,
  useEstimateQty,
  useProducts,
} from "@/lib/hooks";
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
  Scale,
  AlertTriangle,
  List,
  Loader2,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type BatchHeader = {
  supplierName: string;
  purchaseDate: string;
  totalCost: string;
  category: string;
  notes: string;
};

type WeighData = {
  sampleWeight: string;
  sampleQty: string;
  totalWeight: string;
  estimatedQty: number | null;
};

type DamageData = {
  damagedQty: string;
};

type Assignment = {
  variantId: string;
  quantity: string;
  costPerUnit: string;
};

// ─── Step indicators ──────────────────────────────────────────────────────────

const STEPS = [
  { label: "Batch Details", icon: Package },
  { label: "Weighing", icon: Scale },
  { label: "Damages", icon: AlertTriangle },
  { label: "Assign Variants", icon: List },
  { label: "Confirm", icon: CheckCircle },
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
  data: BatchHeader;
  onChange: (d: Partial<BatchHeader>) => void;
  onNext: () => void;
}) {
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
      <div>
        <Label htmlFor="totalCost">Total Cost (₱)</Label>
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
        <Button id="step1-next" onClick={onNext}>
          Next <ChevronRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ─── Step 2: Weighing ─────────────────────────────────────────────────────────

function Step2Weighing({
  data,
  onChange,
  onEstimate,
  isEstimating,
  onNext,
  onBack,
}: {
  data: WeighData;
  onChange: (d: Partial<WeighData>) => void;
  onEstimate: () => void;
  isEstimating: boolean;
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Weigh a sample of items, then weigh the entire bale. We&apos;ll estimate the total quantity for you.
      </p>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="sampleQty">Sample Count</Label>
          <Input
            id="sampleQty"
            type="number"
            min="1"
            step="1"
            placeholder="e.g. 10"
            value={data.sampleQty}
            onChange={(e) => onChange({ sampleQty: e.target.value })}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="sampleWeight">Sample Weight (kg)</Label>
          <Input
            id="sampleWeight"
            type="number"
            min="0"
            step="0.01"
            placeholder="e.g. 1.5"
            value={data.sampleWeight}
            onChange={(e) => onChange({ sampleWeight: e.target.value })}
            className="mt-1"
          />
        </div>
      </div>
      <div>
        <Label htmlFor="totalWeight">Total Bale Weight (kg)</Label>
        <Input
          id="totalWeight"
          type="number"
          min="0"
          step="0.01"
          placeholder="e.g. 45.0"
          value={data.totalWeight}
          onChange={(e) => onChange({ totalWeight: e.target.value })}
          className="mt-1"
        />
      </div>
      <Button
        id="estimate-qty-btn"
        variant="outline"
        onClick={onEstimate}
        disabled={isEstimating || !data.sampleWeight || !data.sampleQty || !data.totalWeight}
        className="w-full"
      >
        {isEstimating ? (
          <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Estimating…</>
        ) : (
          <><Scale className="mr-2 h-4 w-4" /> Calculate Estimate</>
        )}
      </Button>
      {data.estimatedQty !== null && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-center">
          <p className="text-sm text-muted-foreground">Estimated Total Quantity</p>
          <p className="text-4xl font-bold text-primary mt-1">{data.estimatedQty}</p>
          <p className="text-xs text-muted-foreground mt-1">pieces</p>
        </div>
      )}
      <div className="flex justify-between pt-2">
        <Button id="step2-back" variant="outline" onClick={onBack}>
          <ChevronLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <Button id="step2-next" onClick={onNext}>
          Next <ChevronRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ─── Step 3: Damages ──────────────────────────────────────────────────────────

function Step3Damages({
  data,
  estimatedQty,
  onChange,
  onNext,
  onBack,
}: {
  data: DamageData;
  estimatedQty: number | null;
  onChange: (d: Partial<DamageData>) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const damaged = Number(data.damagedQty) || 0;
  const usable = estimatedQty !== null ? Math.max(0, estimatedQty - damaged) : null;
  const pct = estimatedQty ? Math.round((damaged / estimatedQty) * 100) : 0;

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Count items that are torn, stained, or unsellable and record them here.
      </p>
      <div>
        <Label htmlFor="damagedQty">Damaged / Unsellable Count</Label>
        <Input
          id="damagedQty"
          type="number"
          min="0"
          step="1"
          placeholder="0"
          value={data.damagedQty}
          onChange={(e) => onChange({ damagedQty: e.target.value })}
          className="mt-1"
        />
      </div>
      {estimatedQty !== null && (
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Estimated Total</p>
            <p className="text-2xl font-bold">{estimatedQty}</p>
          </div>
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
            <p className="text-xs text-muted-foreground">Damaged</p>
            <p className="text-2xl font-bold text-destructive">{damaged}</p>
            <p className="text-xs text-destructive">{pct}%</p>
          </div>
          <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-3">
            <p className="text-xs text-muted-foreground">Usable</p>
            <p className="text-2xl font-bold text-green-600">{usable}</p>
          </div>
        </div>
      )}
      <div className="flex justify-between pt-2">
        <Button id="step3-back" variant="outline" onClick={onBack}>
          <ChevronLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <Button id="step3-next" onClick={onNext}>
          Next <ChevronRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ─── Step 4: Assign Variants ──────────────────────────────────────────────────

function Step4Assign({
  assignments,
  onChange,
  onNext,
  onBack,
}: {
  assignments: Assignment[];
  onChange: (a: Assignment[]) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const { data: productsData, isLoading } = useProducts({ pageSize: 100 });
  const [search, setSearch] = useState("");

  const allVariants = (productsData?.data ?? []).flatMap((p) =>
    p.variants.map((v) => ({ ...v, productName: p.name }))
  );

  const filtered = allVariants.filter((v) => {
    const q = search.toLowerCase();
    return (
      v.productName.toLowerCase().includes(q) ||
      (v.sku ?? "").toLowerCase().includes(q) ||
      (v.size ?? "").toLowerCase().includes(q) ||
      (v.color ?? "").toLowerCase().includes(q)
    );
  });

  const assignedIds = new Set(assignments.map((a) => a.variantId));

  function toggleVariant(variantId: string) {
    if (assignedIds.has(variantId)) {
      onChange(assignments.filter((a) => a.variantId !== variantId));
    } else {
      onChange([...assignments, { variantId, quantity: "", costPerUnit: "" }]);
    }
  }

  function updateAssignment(variantId: string, field: keyof Assignment, value: string) {
    onChange(
      assignments.map((a) => (a.variantId === variantId ? { ...a, [field]: value } : a))
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Select which variants are in this batch and enter their quantities.
      </p>
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
          {filtered.map((v) => {
            const selected = assignedIds.has(v.id);
            const asgn = assignments.find((a) => a.variantId === v.id);
            return (
              <div key={v.id} className={`rounded-lg border p-3 transition-colors ${selected ? "border-primary/50 bg-primary/5" : "hover:bg-accent"}`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{v.productName}</p>
                    <div className="flex gap-2 text-xs text-muted-foreground flex-wrap">
                      {v.sku && <span>SKU: {v.sku}</span>}
                      {v.size && <span>{v.size}</span>}
                      {v.color && <span>{v.color}</span>}
                      {v.fabric && <span>{v.fabric}</span>}
                    </div>
                  </div>
                  <button
                    id={`toggle-variant-${v.id}`}
                    onClick={() => toggleVariant(v.id)}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                      selected
                        ? "bg-primary text-primary-foreground"
                        : "border border-input hover:bg-accent"
                    }`}
                  >
                    {selected ? "Remove" : "Add"}
                  </button>
                </div>
                {selected && asgn && (
                  <div className="grid grid-cols-2 gap-2 mt-3">
                    <div>
                      <Label className="text-xs">Quantity</Label>
                      <Input
                        id={`qty-${v.id}`}
                        type="number"
                        min="0"
                        step="1"
                        placeholder="0"
                        value={asgn.quantity}
                        onChange={(e) => updateAssignment(v.id, "quantity", e.target.value)}
                        className="h-8 mt-0.5 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Cost/Unit (₱) — optional</Label>
                      <Input
                        id={`cost-${v.id}`}
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="auto"
                        value={asgn.costPerUnit}
                        onChange={(e) => updateAssignment(v.id, "costPerUnit", e.target.value)}
                        className="h-8 mt-0.5 text-sm"
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {filtered.length === 0 && (
            <p className="text-center text-muted-foreground text-sm py-8">No variants match your search.</p>
          )}
        </div>
      )}
      {assignments.length > 0 && (
        <p className="text-sm text-primary font-medium">{assignments.length} variant(s) selected</p>
      )}
      <div className="flex justify-between pt-2">
        <Button id="step4-back" variant="outline" onClick={onBack}>
          <ChevronLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <Button id="step4-next" onClick={onNext} disabled={assignments.length === 0}>
          Review <ChevronRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ─── Step 5: Confirm ──────────────────────────────────────────────────────────

function Step5Confirm({
  header,
  weigh,
  damage,
  assignments,
  isSubmitting,
  onSubmit,
  onBack,
}: {
  header: BatchHeader;
  weigh: WeighData;
  damage: DamageData;
  assignments: Assignment[];
  isSubmitting: boolean;
  onSubmit: () => void;
  onBack: () => void;
}) {
  const { data: productsData } = useProducts({ pageSize: 100 });
  const allVariants = (productsData?.data ?? []).flatMap((p) =>
    p.variants.map((v) => ({ ...v, productName: p.name }))
  );
  const getVariant = (id: string) => allVariants.find((v) => v.id === id);

  const totalQty = assignments.reduce((s, a) => s + (Number(a.quantity) || 0), 0);

  return (
    <div className="space-y-5">
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="rounded-lg border p-4 space-y-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Supplier</p>
          <p className="font-medium">{header.supplierName || "—"}</p>
          <p className="text-sm text-muted-foreground">{header.purchaseDate || "No date"}</p>
        </div>
        <div className="rounded-lg border p-4 space-y-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Financials</p>
          <p className="font-medium">₱{Number(header.totalCost || 0).toLocaleString()} total cost</p>
          <p className="text-sm text-muted-foreground">{header.category || "No category"}</p>
        </div>
        <div className="rounded-lg border p-4 space-y-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Estimated Qty</p>
          <p className="font-medium">{weigh.estimatedQty ?? "—"} pieces</p>
          <p className="text-sm text-muted-foreground">Bale weight: {weigh.totalWeight || "—"} kg</p>
        </div>
        <div className="rounded-lg border p-4 space-y-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Damages</p>
          <p className="font-medium text-destructive">{damage.damagedQty || "0"} damaged</p>
          <p className="text-sm text-muted-foreground">{totalQty} assigned to variants</p>
        </div>
      </div>

      <div>
        <p className="text-sm font-semibold mb-2">Variant Assignments</p>
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {assignments.map((a) => {
            const v = getVariant(a.variantId);
            return (
              <div key={a.variantId} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                <div>
                  <span className="font-medium">{v?.productName ?? "Unknown"}</span>
                  <span className="text-muted-foreground ml-2">
                    {[v?.sku, v?.size, v?.color].filter(Boolean).join(" / ")}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="outline">{a.quantity || 0} pcs</Badge>
                  {a.costPerUnit && <span className="text-muted-foreground text-xs">₱{a.costPerUnit}/unit</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {header.notes && (
        <div className="rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Notes: </span>{header.notes}
        </div>
      )}

      <div className="flex justify-between pt-2">
        <Button id="step5-back" variant="outline" onClick={onBack} disabled={isSubmitting}>
          <ChevronLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <Button id="step5-submit" onClick={onSubmit} disabled={isSubmitting} className="min-w-32">
          {isSubmitting ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing…</>
          ) : (
            <><CheckCircle className="mr-2 h-4 w-4" /> Confirm & Save</>
          )}
        </Button>
      </div>
    </div>
  );
}

// ─── Main Wizard ──────────────────────────────────────────────────────────────

export default function NewBatchPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);

  const [header, setHeader] = useState<BatchHeader>({
    supplierName: "",
    purchaseDate: "",
    totalCost: "",
    category: "",
    notes: "",
  });
  const [weigh, setWeigh] = useState<WeighData>({
    sampleWeight: "",
    sampleQty: "",
    totalWeight: "",
    estimatedQty: null,
  });
  const [damage, setDamage] = useState<DamageData>({ damagedQty: "" });
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [batchId, setBatchId] = useState<string | null>(null);

  const createBatch = useCreateBatch();
  const estimateQty = useEstimateQty();
  // processHook is only instantiated when we have an id
  const processBatch = useProcessBatch(batchId ?? "");

  const isSubmitting = createBatch.isPending || processBatch.isPending;

  async function handleEstimate() {
    try {
      const result = await estimateQty.mutateAsync({
        sampleWeight: Number(weigh.sampleWeight),
        sampleQty: Number(weigh.sampleQty),
        totalWeight: Number(weigh.totalWeight),
      });
      setWeigh((w) => ({ ...w, estimatedQty: result.estimatedTotalQty }));
      toast.success(`Estimated ${result.estimatedTotalQty} pieces (${result.weightPerUnit} kg/unit)`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Estimation failed");
    }
  }

  async function handleSubmit() {
    try {
      // Step A: Create the batch header
      let id = batchId;
      if (!id) {
        const batch = await createBatch.mutateAsync({
          supplierName: header.supplierName || null,
          purchaseDate: header.purchaseDate ? new Date(header.purchaseDate) : null,
          totalCost: header.totalCost ? Number(header.totalCost) : null,
          estimatedQty: weigh.estimatedQty ?? null,
          category: header.category || null,
          notes: header.notes || null,
        });
        id = batch.id;
        setBatchId(id);
      }

      // Step B: Process the batch with assignments
      await processBatch.mutateAsync({
        assignments: assignments
          .filter((a) => Number(a.quantity) > 0)
          .map((a) => ({
            variantId: a.variantId,
            quantity: Number(a.quantity),
            costPerUnit: a.costPerUnit ? Number(a.costPerUnit) : null,
          })),
        damagedQty: Number(damage.damagedQty) || 0,
        actualQty: weigh.estimatedQty ?? undefined,
      });

      toast.success("Batch saved and stock updated!");
      router.push("/batches");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to save batch");
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-2">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-3xl font-bold tracking-tight">New Batch</h1>
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
            <Step2Weighing
              data={weigh}
              onChange={(d) => setWeigh((w) => ({ ...w, ...d }))}
              onEstimate={handleEstimate}
              isEstimating={estimateQty.isPending}
              onNext={() => setStep(2)}
              onBack={() => setStep(0)}
            />
          )}
          {step === 2 && (
            <Step3Damages
              data={damage}
              estimatedQty={weigh.estimatedQty}
              onChange={(d) => setDamage((dm) => ({ ...dm, ...d }))}
              onNext={() => setStep(3)}
              onBack={() => setStep(1)}
            />
          )}
          {step === 3 && (
            <Step4Assign
              assignments={assignments}
              onChange={setAssignments}
              onNext={() => setStep(4)}
              onBack={() => setStep(2)}
            />
          )}
          {step === 4 && (
            <Step5Confirm
              header={header}
              weigh={weigh}
              damage={damage}
              assignments={assignments}
              isSubmitting={isSubmitting}
              onSubmit={handleSubmit}
              onBack={() => setStep(3)}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
