"use client";

import { useState } from "react";
import { useCategories } from "@/lib/hooks";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { FolderTree, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/hooks";

async function createCategory(name: string) {
  return apiFetch<{ id: string; name: string }>("/api/categories", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

async function deleteCategory(id: string) {
  return apiFetch(`/api/categories/${id}`, { method: "DELETE" });
}

export default function CategoriesPage() {
  const { data: categories, isLoading, refetch } = useCategories();
  const [newName, setNewName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setIsCreating(true);
    try {
      await createCategory(newName.trim());
      toast.success("Category created");
      setNewName("");
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create category");
    } finally {
      setIsCreating(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteCategory(id);
      toast.success("Category deleted");
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete category");
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Categories</h1>
      </div>

      {/* Create Form */}
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleCreate} className="flex gap-4">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="New category name"
              className="flex-1"
            />
            <Button type="submit" disabled={isCreating || !newName.trim()}>
              <Plus className="mr-2 h-4 w-4" />
              {isCreating ? "Adding..." : "Add"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Categories List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      ) : categories?.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FolderTree className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No categories yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {categories?.map((c) => (
            <Card key={c.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <FolderTree className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{c.name}</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive"
                  onClick={() => handleDelete(c.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
