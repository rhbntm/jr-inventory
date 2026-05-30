"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  ProductWithVariants,
  MovementWithDetails,
  CreateProductInput,
  CreateVariantInput,
  CreateMovementInput,
  PaginatedResponse,
  DashboardStats,
  LowStockItem,
} from "./types";
import type { ProductVariant } from "@prisma/client";

export const queryKeys = {
  dashboard: ["dashboard"] as const,
  products: (params?: Record<string, unknown>) => ["products", params] as const,
  product: (id: string) => ["products", id] as const,
  movements: (params?: Record<string, unknown>) => ["movements", params] as const,
  categories: ["categories"] as const,
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
};

export function useProducts(params: ProductsParams = {}) {
  return useQuery({
    queryKey: queryKeys.products(params),
    queryFn: () =>
      apiFetch<PaginatedResponse<ProductWithVariants>>(`/api/products?${buildQuery(params)}`),
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
    mutationFn: (data: CreateProductInput) =>
      apiFetch<ProductWithVariants>("/api/products", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["products"] }); },
  });
}

export function useUpdateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateProductInput> }) =>
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
    mutationFn: (data: CreateVariantInput) =>
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
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateVariantInput> }) =>
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
      // Note: We don't have the productId here easily unless we pass it to the hook,
      // but invalidating "products" and all "product" queries is safer.
      qc.invalidateQueries({ queryKey: ["products"] });
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
    mutationFn: (data: CreateMovementInput) =>
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

// Categories
export function useCategories() {
  return useQuery({
    queryKey: queryKeys.categories,
    queryFn: () => apiFetch<{ id: string; name: string }[]>("/api/categories"),
  });
}

// ─── Batches ─────────────────────────────────────────────────────────────────

import type { BatchWithMovements, BatchAnalytics } from "./types";
import type { BatchInput, BatchProcessInput, EstimateInput } from "./schemas";

export const batchQueryKeys = {
  all: ["batches"] as const,
  list: (params?: Record<string, unknown>) => ["batches", "list", params] as const,
  detail: (id: string) => ["batches", id] as const,
  analytics: ["batches", "analytics"] as const,
};

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

export function useProcessBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: BatchProcessInput }) =>
      apiFetch<BatchWithMovements>(`/api/batches/${id}/process`, { method: "POST", body: JSON.stringify(data) }),
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
