"use client";

import { useState } from "react";
import { useReservations, useUpdateReservation, useProducts } from "@/lib/hooks";
import type { ReservationWithDetails } from "@/lib/types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Truck,
  CheckCircle2,
  XCircle,
  Undo2,
  Lock,
  ChevronDown,
  Search,
  RotateCcw,
  CalendarCheck2,
} from "lucide-react";
import { toast } from "sonner";
import { cn, formatDate } from "@/lib/utils";

export default function ReservationsPage() {
  // Query Filters State
  const [stateFilter, setStateFilter] = useState<string>("ALL");
  const [customerFilter, setCustomerFilter] = useState<string>("");
  const [variantFilterId, setVariantFilterId] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [page, setPage] = useState<number>(1);
  const [variantSearchOpen, setVariantSearchOpen] = useState(false);

  // Queries
  const { data: productsData } = useProducts({ pageSize: 1000 });
  const { data: resData, isLoading } = useReservations({
    state: stateFilter === "ALL" ? undefined : stateFilter,
    variantId: variantFilterId || undefined,
    customerName: customerFilter.trim() || undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    page,
    pageSize: 10,
  });

  const updateReservation = useUpdateReservation();

  // Action Dialog States
  const [selectedResForCancel, setSelectedResForCancel] = useState<ReservationWithDetails | null>(null);
  const [selectedResForReturn, setSelectedResForReturn] = useState<ReservationWithDetails | null>(null);
  const [restockOnReturn, setRestockOnReturn] = useState<boolean>(true);

  // Flatten all variants for the filter select
  const allVariants = productsData?.data.flatMap((product) =>
    product.variants.map((variant) => ({
      id: variant.id,
      label: `${product.name} — ${[variant.size, variant.color, variant.sku].filter(Boolean).join(" / ") || "No details"}`,
      searchText: `${product.name} ${variant.sku ?? ""} ${variant.size ?? ""} ${variant.color ?? ""}`.toLowerCase(),
    }))
  ) ?? [];

  const selectedVariantLabel = allVariants.find((v) => v.id === variantFilterId)?.label;

  const handleAction = async (id: string, action: string, restock?: boolean) => {
    try {
      await updateReservation.mutateAsync({
        id,
        data: {
          action: action as any, // eslint-disable-line @typescript-eslint/no-explicit-any
          restock: restock,
        },
      });
      toast.success(`Reservation successfully updated to state: ${action.toUpperCase()}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update reservation");
    }
  };

  const resetFilters = () => {
    setStateFilter("ALL");
    setCustomerFilter("");
    setVariantFilterId("");
    setStartDate("");
    setEndDate("");
    setPage(1);
  };

  const getBadgeClass = (state: string) => {
    switch (state) {
      case "RESERVED":
        return "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-50";
      case "SHIPPING":
        return "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-50";
      case "SHIPPED":
        return "bg-green-50 text-green-700 border-green-200 hover:bg-green-50";
      case "RELEASED":
        return "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-100";
      case "RETURNED":
        return "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-50";
      case "CANCELLED":
        return "bg-red-50 text-red-700 border-red-200 hover:bg-red-50";
      default:
        return "";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reservations</h1>
          <p className="text-muted-foreground text-sm">
            Track and manage stock allocations from Reserve to Final Delivery or Return.
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="rounded-lg border bg-card p-4 space-y-4 shadow-sm">
        <div className="flex items-center justify-between border-b pb-2">
          <h2 className="text-sm font-semibold flex items-center gap-1.5">
            <CalendarCheck2 className="h-4 w-4 text-muted-foreground" />
            Filter Allocations
          </h2>
          <Button variant="ghost" size="sm" onClick={resetFilters} className="h-8 px-2 text-xs">
            <RotateCcw className="mr-1 h-3.5 w-3.5" />
            Reset Filters
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
          {/* Customer Search */}
          <div className="space-y-1.5">
            <Label htmlFor="customerFilter">Customer</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="customerFilter"
                placeholder="Search customer..."
                value={customerFilter}
                onChange={(e) => {
                  setCustomerFilter(e.target.value);
                  setPage(1);
                }}
                className="pl-8 h-9"
              />
            </div>
          </div>

          {/* State Filter */}
          <div className="space-y-1.5">
            <Label htmlFor="stateFilter">State</Label>
            <Select
              value={stateFilter}
              onValueChange={(val) => {
                if (val) {
                  setStateFilter(val);
                  setPage(1);
                }
              }}
            >
              <SelectTrigger id="stateFilter" className="h-9">
                <SelectValue placeholder="All States" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All States</SelectItem>
                <SelectItem value="RESERVED">RESERVED</SelectItem>
                <SelectItem value="SHIPPING">SHIPPING</SelectItem>
                <SelectItem value="SHIPPED">SHIPPED</SelectItem>
                <SelectItem value="RELEASED">RELEASED</SelectItem>
                <SelectItem value="RETURNED">RETURNED</SelectItem>
                <SelectItem value="CANCELLED">CANCELLED</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Variant Filter */}
          <div className="space-y-1.5 md:col-span-2">
            <Label>Product Variant</Label>
            <Popover open={variantSearchOpen} onOpenChange={setVariantSearchOpen}>
              <PopoverTrigger className="w-full h-9 flex items-center justify-between rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm hover:bg-accent text-left truncate">
                {selectedVariantLabel ? (
                  <span className="truncate">{selectedVariantLabel}</span>
                ) : (
                  <span className="text-muted-foreground">All Variants</span>
                )}
                <ChevronDown className="h-4 w-4 opacity-50 shrink-0 ml-2" />
              </PopoverTrigger>
              <PopoverContent className="w-[400px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search variant..." className="h-9" />
                  <CommandList className="max-h-[250px]">
                    <CommandEmpty>No variants found.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        value=""
                        onSelect={() => {
                          setVariantFilterId("");
                          setVariantSearchOpen(false);
                          setPage(1);
                        }}
                      >
                        All Variants
                      </CommandItem>
                      {allVariants.map((v) => (
                        <CommandItem
                          key={v.id}
                          value={v.searchText}
                          onSelect={() => {
                            setVariantFilterId(v.id);
                            setVariantSearchOpen(false);
                            setPage(1);
                          }}
                        >
                          {v.label}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Date range inputs */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPage(1);
                }}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPage(1);
                }}
                className="h-9"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Reservations Table */}
      <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead>Product / Variant</TableHead>
              <TableHead className="text-center">Quantity</TableHead>
              <TableHead>State</TableHead>
              <TableHead>Reserved At</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  Loading allocations...
                </TableCell>
              </TableRow>
            ) : !resData?.data?.length ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No reservations found matching active filters.
                </TableCell>
              </TableRow>
            ) : (
              (resData.data as ReservationWithDetails[]).map((res) => (
                <TableRow key={res.id}>
                  <TableCell className="font-semibold text-primary">
                    {res.customerName || <span className="text-muted-foreground italic">Walk-in</span>}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium text-foreground">{res.variant?.product?.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {[res.variant?.size, res.variant?.color, res.variant?.sku]
                        .filter(Boolean)
                        .join(" / ") || "No details"}
                    </div>
                  </TableCell>
                  <TableCell className="text-center font-bold text-sm">
                    {res.quantity}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn("px-2.5 py-0.5 text-xs font-semibold", getBadgeClass(res.state))}>
                      {res.state}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDate(res.reservedAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {res.state === "RESERVED" && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200 h-8 px-2"
                            onClick={() => handleAction(res.id, "ship")}
                          >
                            <Truck className="h-3.5 w-3.5 mr-1" />
                            Ship
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-slate-700 hover:bg-slate-100 h-8 px-2"
                            onClick={() => handleAction(res.id, "release")}
                          >
                            <Lock className="h-3.5 w-3.5 mr-1" />
                            Release
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive hover:bg-red-50 border-red-200 h-8 px-2"
                            onClick={() => setSelectedResForCancel(res)}
                          >
                            <XCircle className="h-3.5 w-3.5 mr-1" />
                            Cancel
                          </Button>
                        </>
                      )}
                      {res.state === "SHIPPING" && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="bg-green-50 hover:bg-green-100 text-green-700 border-green-200 h-8 px-2"
                            onClick={() => handleAction(res.id, "deliver")}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                            Deliver
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-slate-700 hover:bg-slate-100 h-8 px-2"
                            onClick={() => handleAction(res.id, "release")}
                          >
                            <Lock className="h-3.5 w-3.5 mr-1" />
                            Release
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive hover:bg-red-50 border-red-200 h-8 px-2"
                            onClick={() => setSelectedResForCancel(res)}
                          >
                            <XCircle className="h-3.5 w-3.5 mr-1" />
                            Cancel
                          </Button>
                        </>
                      )}
                      {res.state === "SHIPPED" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200 h-8 px-2"
                          onClick={() => {
                            setSelectedResForReturn(res);
                            setRestockOnReturn(true);
                          }}
                        >
                          <Undo2 className="h-3.5 w-3.5 mr-1" />
                          Return
                        </Button>
                      )}
                      {["RELEASED", "RETURNED", "CANCELLED"].includes(res.state) && (
                        <span className="text-xs text-muted-foreground px-2">Terminal</span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {/* Pagination */}
        {resData && resData.totalPages > 1 && (
          <div className="flex items-center justify-between border-t p-4">
            <span className="text-xs text-muted-foreground">
              Page {resData.page} of {resData.totalPages} ({resData.total} items)
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(resData.totalPages, p + 1))}
                disabled={page >= resData.totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Return Dialog */}
      <Dialog open={!!selectedResForReturn} onOpenChange={() => setSelectedResForReturn(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Return Items to Inventory</DialogTitle>
            <DialogDescription>
              Process a return for reservation of {selectedResForReturn?.quantity} unit(s) of{" "}
              <strong>{selectedResForReturn?.variant?.product?.name}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 flex items-center space-x-2.5">
            <input
              type="checkbox"
              id="restockCheckbox"
              checked={restockOnReturn}
              onChange={(e) => setRestockOnReturn(e.target.checked)}
              className="h-4.5 w-4.5 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <Label htmlFor="restockCheckbox" className="text-sm font-semibold select-none cursor-pointer">
              Restock returning items back into physical inventory?
            </Label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedResForReturn(null)}>
              Cancel
            </Button>
            <Button
              className="bg-purple-600 hover:bg-purple-700 text-white"
              onClick={() => {
                if (selectedResForReturn) {
                  handleAction(selectedResForReturn.id, "return", restockOnReturn);
                  setSelectedResForReturn(null);
                }
              }}
            >
              Confirm Return
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Dialog */}
      <Dialog open={!!selectedResForCancel} onOpenChange={() => setSelectedResForCancel(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Reservation</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel the reservation for {selectedResForCancel?.quantity} unit(s) of{" "}
              <strong>{selectedResForCancel?.variant?.product?.name}</strong>?
              This will immediately release the reserved stock back into available stock.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedResForCancel(null)}>
              No, Keep
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (selectedResForCancel) {
                  handleAction(selectedResForCancel.id, "cancel");
                  setSelectedResForCancel(null);
                }
              }}
            >
              Yes, Cancel Reservation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
