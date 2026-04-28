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

export const queryKeys = {
  dashboard: ["dashboard"] as const,
  products: (params?: Record<string, unknown>) => ["products", params] as const,
  product: (id: string) => ["products", id] as const,
  movements: (params?: Record<string, unknown>) => ["movements", params] as const,
  categories: ["categories"] as const,
};

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
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

export function useUpdateProduct(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<CreateProductInput>) =>
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

export function useUpdateVariant(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<CreateVariantInput>) =>
      apiFetch(`/api/variants/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["products"] }); },
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
