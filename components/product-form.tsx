"use client";

import { useState, useEffect } from "react";
import { useCategories, useCreateProduct, useUpdateProduct } from "@/lib/hooks";
import { productSchema, type ProductInput } from "@/lib/schemas";
import type { ProductWithVariants } from "@/lib/types";
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

  const [formData, setFormData] = useState<ProductInput>({
    name: "",
    description: "",
    categoryId: undefined,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const isPending = createProduct.isPending || updateProduct.isPending;

  // Initialize form when editing
  useEffect(() => {
    if (product) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFormData({
        name: product.name,
        description: product.description ?? "",
        categoryId: product.categoryId ?? undefined,
      });
    }
  }, [product]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = productSchema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        const path = issue.path[0] as string;
        if (path && !fieldErrors[path]) {
          fieldErrors[path] = issue.message;
        }
      });
      setErrors(fieldErrors);
      toast.error("Please check the form for errors");
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
      const message = err instanceof Error ? err.message : "Failed to save product";
      toast.error(message);
      if (message.toLowerCase().includes("name")) {
        setErrors({ name: "A product with this name already exists" });
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name" className={errors.name ? "text-destructive" : ""}>
          Product Name <span className="text-destructive">*</span>
        </Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => {
            setFormData({ ...formData, name: e.target.value });
            if (errors.name) setErrors({ ...errors, name: "" });
          }}
          placeholder="Enter product name..."
          disabled={isPending}
          className={errors.name ? "border-destructive focus-visible:ring-destructive" : ""}
        />
        {errors.name && <p className="text-xs text-destructive font-medium">{errors.name}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={formData.description ?? ""}
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
