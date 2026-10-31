"use client";

import { keepPreviousData, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  ProductWithVariants,
  MovementWithDetails,
  PaginatedResponse,
  DashboardStats,
  LowStockItem,
  BatchWithMovements,
  BatchAnalytics,
  ReservationWithDetails,
  AvailableStockResponse,
} from "./types";
import type { ProductVariant, ReservationState } from "@prisma/client";
import type {
  ProductInput,
  VariantInput,
  MovementInput,
  BatchInput,
  BatchProcessInput,
  EstimateInput,
  CreateReservationInput,
  UpdateReservationInput,
  ManualBatchInput,
  SettingsMarkupInput,
  ConditionAdjustInput,
  InviteUserInput,
  UpdateUserInput,
} from "./schemas";
import type { PublicUser } from "@/app/repositories/userRepo";

export const queryKeys = {
  dashboard: ["dashboard"] as const,
  products: (params?: Record<string, unknown>) => ["products", params] as const,
  product: (id: string) => ["products", id] as const,
  movements: (params?: Record<string, unknown>) => ["movements", params] as const,
  categories: ["categories"] as const,
  reservations: (params?: Record<string, unknown>) => ["reservations", params] as const,
  availableStock: (variantId: string) => ["availableStock", variantId] as const,
};

export const batchQueryKeys = {
  all: ["batches"] as const,
  list: (params?: Record<string, unknown>) => ["batches", "list", params] as const,
  detail: (id: string) => ["batches", id] as const,
  analytics: ["batches", "analytics"] as const,
};

export const settingsQueryKeys = {
  markup: ["settings", "markup"] as const,
};

export async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Request failed");
  return data as T;
}

function buildQuery(params: Record<string, unknown>) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  });
  return qs.toString();
}

// Dashboard
export function useDashboard() {
  return useQuery({
    queryKey: queryKeys.dashboard,
    queryFn: () =>
      apiFetch<{ stats: DashboardStats; lowStockItems: LowStockItem[] }>("/api/dashboard"),
    refetchInterval: 30_000,
  });
}

// Products
type ProductsParams = {
  search?: string;
  categoryId?: string;
  page?: number;
  pageSize?: number;
  showArchived?: boolean;
};

export function useProducts(params: ProductsParams = {}) {
  const finalParams = { showArchived: false, ...params };
  return useQuery({
    queryKey: queryKeys.products(finalParams),
    queryFn: () =>
      apiFetch<PaginatedResponse<ProductWithVariants>>(`/api/products?${buildQuery(finalParams)}`),
  });
}

/**
 * Every active product, for searching on the client. The API returns at most 100 per
 * page, so asking for one big page would silently leave products out.
 */
export function useAllProducts(options: { refetchInterval?: number } = {}) {
  return useQuery({
    queryKey: ["products", "all"],
    queryFn: async () => {
      const products: ProductWithVariants[] = [];
      let page = 1;
      let totalPages = 1;
      do {
        const result = await apiFetch<PaginatedResponse<ProductWithVariants>>(
          `/api/products?${buildQuery({ showArchived: false, pageSize: 100, page })}`
        );
        products.push(...result.data);
        totalPages = result.totalPages;
        page += 1;
      } while (page <= totalPages);
      return products;
    },
    refetchInterval: options.refetchInterval,
  });
}

export function useProduct(id: string) {
  return useQuery({
    queryKey: queryKeys.product(id),
    queryFn: () => apiFetch<ProductWithVariants>(`/api/products/${id}`),
    enabled: !!id,
  });
}

export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ProductInput) =>
      apiFetch<ProductWithVariants>("/api/products", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["products"] }); },
  });
}

export function useUpdateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ProductInput> }) =>
      apiFetch<ProductWithVariants>(`/api/products/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["products"] }); },
  });
}

export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/api/products/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["products"] }); },
  });
}

// Variants
export function useCreateVariant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: VariantInput) =>
      apiFetch("/api/variants", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: queryKeys.product(variables.productId) });
    },
  });
}

export function useUpdateVariant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<VariantInput> }) =>
      apiFetch<ProductVariant & { productId: string }>(`/api/variants/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["products"] });
      if (data.productId) {
        qc.invalidateQueries({ queryKey: queryKeys.product(data.productId) });
      }
    },
  });
}

export function useDeleteVariant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/api/variants/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
    },
  });
}

export function useAdjustConditionStock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ConditionAdjustInput }) =>
      apiFetch<ProductVariant & { productId: string }>(`/api/variants/${id}/condition`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["products"] });
      if (data.productId) {
        qc.invalidateQueries({ queryKey: queryKeys.product(data.productId) });
      }
      qc.invalidateQueries({ queryKey: ["movements"] });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}

// Movements
type MovementsParams = {
  variantId?: string;
  productId?: string;
  type?: "IN" | "OUT" | "ADJUSTMENT";
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
};

export function useMovements(params: MovementsParams = {}) {
  return useQuery({
    queryKey: queryKeys.movements(params),
    queryFn: () =>
      apiFetch<PaginatedResponse<MovementWithDetails>>(`/api/movements?${buildQuery(params)}`),
  });
}

export function useCreateMovement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: MovementInput) =>
      apiFetch<MovementWithDetails>("/api/movements", { method: "POST", body: JSON.stringify(data) }),
    onMutate: async (newMovement) => {
      // Cancel outgoing refetches
      await qc.cancelQueries({ queryKey: ["products"] });
      await qc.cancelQueries({ queryKey: ["movements"] });
      await qc.cancelQueries({ queryKey: queryKeys.dashboard });

      // Snapshot previous values
      const previousProducts = qc.getQueryData<PaginatedResponse<ProductWithVariants>>(["products"]);
      const previousMovements = qc.getQueryData<PaginatedResponse<MovementWithDetails>>(["movements"]);
      const previousDashboard = qc.getQueryData<{ stats: DashboardStats; lowStockItems: LowStockItem[] }>(queryKeys.dashboard);

      // Optimistically update products stock
      if (previousProducts) {
        const delta = newMovement.type === "IN" ? newMovement.quantity : -newMovement.quantity;
        qc.setQueryData(["products"], {
          ...previousProducts,
          data: previousProducts.data.map((product) => ({
            ...product,
            variants: product.variants.map((variant) =>
              variant.id === newMovement.variantId
                ? { ...variant, currentStock: Math.max(0, variant.currentStock + delta) }
                : variant
            ),
          })),
        });
      }

      return { previousProducts, previousMovements, previousDashboard };
    },
    onError: (_err, _newMovement, context) => {
      // Rollback on error
      if (context?.previousProducts) {
        qc.setQueryData(["products"], context.previousProducts);
      }
      if (context?.previousMovements) {
        qc.setQueryData(["movements"], context.previousMovements);
      }
      if (context?.previousDashboard) {
        qc.setQueryData(queryKeys.dashboard, context.previousDashboard);
      }
    },
    onSettled: () => {
      // Always refetch after error or success
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["movements"] });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}

export function useUndoMovement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<MovementWithDetails>(`/api/movements/${id}/undo`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["movements"] });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}

// Categories
export function useCategories() {
  return useQuery({
    queryKey: queryKeys.categories,
    queryFn: () => apiFetch<{ id: string; name: string }[]>("/api/categories"),
  });
}

// ─── Batches ─────────────────────────────────────────────────────────────────

export function useBatches(params: { page?: number; pageSize?: number } = {}) {
  return useQuery({
    queryKey: batchQueryKeys.list(params),
    queryFn: () =>
      apiFetch<{ data: BatchWithMovements[]; total: number; page: number; pageSize: number; totalPages: number }>(
        `/api/batches?${buildQuery(params)}`
      ),
  });
}

export function useBatch(id: string) {
  return useQuery({
    queryKey: batchQueryKeys.detail(id),
    queryFn: () => apiFetch<BatchWithMovements>(`/api/batches/${id}`),
    enabled: !!id,
  });
}

export function useCreateBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: BatchInput) =>
      apiFetch<BatchWithMovements>("/api/batches", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: batchQueryKeys.all }); },
  });
}

export function useCreateManualBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ManualBatchInput) =>
      apiFetch<BatchWithMovements>("/api/batches/manual", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: batchQueryKeys.all });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}

export function useProcessBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: BatchProcessInput }) =>
      apiFetch<BatchWithMovements>(`/api/batches/${id}/process`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: batchQueryKeys.all });
      qc.invalidateQueries({ queryKey: batchQueryKeys.detail(id) });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}

export function useReprocessBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: BatchProcessInput }) =>
      apiFetch<BatchWithMovements>(`/api/batches/${id}/reprocess`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: batchQueryKeys.all });
      qc.invalidateQueries({ queryKey: batchQueryKeys.detail(id) });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}

export function useEstimateQty() {
  return useMutation({
    mutationFn: (data: EstimateInput) =>
      apiFetch<{ estimatedTotalQty: number; weightPerUnit: number }>("/api/batches/estimate", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  });
}

export function useBatchAnalytics() {
  return useQuery({
    queryKey: batchQueryKeys.analytics,
    queryFn: () => apiFetch<BatchAnalytics>("/api/batches/analytics"),
  });
}

// ─── Reservations ────────────────────────────────────────────────────────────

export function useReservations(params: Record<string, unknown> = {}) {
  return useQuery({
    queryKey: queryKeys.reservations(params),
    queryFn: () =>
      apiFetch<PaginatedResponse<ReservationWithDetails>>(`/api/reservations?${buildQuery(params)}`),
    // Keeps the list steady while a search is typed, but never shows another stage's
    // rows, whose buttons would act on the wrong thing.
    placeholderData: (previous, previousQuery) => {
      const previousParams = previousQuery?.queryKey[1] as Record<string, unknown> | undefined;
      return previousParams?.state === params.state ? keepPreviousData(previous) : undefined;
    },
  });
}

export function useReservationCounts() {
  return useQuery({
    queryKey: ["reservations", "counts"],
    queryFn: () =>
      apiFetch<{ counts: Record<ReservationState, number>; oldestReservedAt: string | null }>(
        "/api/reservations/counts"
      ),
    refetchInterval: 30_000,
  });
}

export function useCreateReservation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateReservationInput) =>
      apiFetch<ReservationWithDetails>("/api/reservations", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ["reservations"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: queryKeys.availableStock(variables.variantId) });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}

export function useUpdateReservation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateReservationInput }) =>
      apiFetch<ReservationWithDetails>(`/api/reservations/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["reservations"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: queryKeys.availableStock(data.variantId) });
      if (data.state === "SHIPPED" || data.state === "RETURNED") {
        qc.invalidateQueries({ queryKey: ["movements"] });
      }
      qc.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}

export function useAvailableStock(variantId: string) {
  return useQuery({
    queryKey: queryKeys.availableStock(variantId),
    queryFn: () => apiFetch<AvailableStockResponse>(`/api/reservations/available-stock/${variantId}`),
    enabled: !!variantId,
  });
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export function useMarkupSettings() {
  return useQuery({
    queryKey: settingsQueryKeys.markup,
    queryFn: () => apiFetch<{ markupPercent: number; fixedMarkup: number }>("/api/settings/markup"),
  });
}

export function useUpdateMarkupSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: SettingsMarkupInput) =>
      apiFetch<{ success: boolean }>("/api/settings/markup", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: settingsQueryKeys.markup });
    },
  });
}

// ─── Users (OWNER only) ───────────────────────────────────────────────────────

export const userQueryKeys = {
  all: ["users"] as const,
};

export function useUsers(enabled = true) {
  return useQuery({
    queryKey: userQueryKeys.all,
    queryFn: () => apiFetch<PublicUser[]>("/api/users"),
    enabled,
  });
}

export function useInviteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: InviteUserInput) =>
      apiFetch<PublicUser>("/api/users", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: userQueryKeys.all }); },
  });
}

export function useUpdateUserRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateUserInput }) =>
      apiFetch<PublicUser>(`/api/users/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: userQueryKeys.all }); },
  });
}

export function useRemoveUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/api/users/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: userQueryKeys.all }); },
  });
}
