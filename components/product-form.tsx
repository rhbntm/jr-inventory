"use client";

import { useState, useEffect } from "react";
import { useCategories, useCreateProduct, useUpdateProduct } from "@/lib/hooks";
import { productSchema } from "@/lib/schemas";
import type { ProductWithVariants, CreateProductInput } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface ProductFormProps {
  product?: ProductWithVariants;
  onSuccess?: () => void;
}

export function ProductForm({ product, onSuccess }: ProductFormProps) {
  const isEditing = !!product;
  const { data: categories, isLoading: categoriesLoading } = useCategories();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();

  const [formData, setFormData] = useState<CreateProductInput>({
    name: "",
    description: "",
    categoryId: undefined,
  });

  // Initialize form when editing
  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name,
        description: product.description ?? "",
        categoryId: product.categoryId ?? undefined,
      });
    }
  }, [product]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const result = productSchema.safeParse(formData);
    if (!result.success) {
      toast.error(result.error.errors[0].message);
      return;
    }

    try {
      if (isEditing) {
        await updateProduct.mutateAsync({
          id: product.id,
          data: result.data,
        });
        toast.success("Product updated successfully");
      } else {
        await createProduct.mutateAsync(result.data);
        toast.success("Product created successfully");
      }

      if (!isEditing) {
        setFormData({ name: "", description: "", categoryId: undefined });
      }
      onSuccess?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save product");
    }
  };

  const isPending = createProduct.isPending || updateProduct.isPending;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">
          Product Name <span className="text-destructive">*</span>
        </Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="Enter product name..."
          disabled={isPending}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Enter product description..."
          rows={3}
          disabled={isPending}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="category">Category</Label>
        <Select
          value={formData.categoryId ?? "none"}
          onValueChange={(value) =>
            setFormData({ ...formData, categoryId: value === "none" ? undefined : value as string })
          }
          disabled={isPending || categoriesLoading}
        >
          <SelectTrigger id="category">
            <SelectValue placeholder="Select a category..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No Category</SelectItem>
            {categories?.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button type="submit" className="w-full" disabled={isPending || !formData.name.trim()}>
        {isPending ? (isEditing ? "Updating..." : "Creating...") : isEditing ? "Update Product" : "Create Product"}
      </Button>
    </form>
  );
}
