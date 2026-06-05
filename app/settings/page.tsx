"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { useMarkupSettings, useUpdateMarkupSettings } from "@/lib/hooks";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Download, AlertTriangle, DatabaseBackup, Trash2 } from "lucide-react";

export default function SettingsPage() {
  const { data: session } = useSession();
  const [resetType, setResetType] = useState<"STOCK" | "FULL" | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [isResetting, setIsResetting] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  // Markup Settings state
  const { data: markupData, isLoading: isMarkupLoading } = useMarkupSettings();
  const updateMarkup = useUpdateMarkupSettings();
  
  const [markupPercentInput, setMarkupPercentInput] = useState<string | null>(null);
  const [fixedMarkupInput, setFixedMarkupInput] = useState<string | null>(null);

  const markupPercent = markupPercentInput ?? markupData?.markupPercent?.toString() ?? "";
  const fixedMarkup = fixedMarkupInput ?? markupData?.fixedMarkup?.toString() ?? "";

  const isOwner = session?.user?.role === "OWNER";

  const handleSaveMarkup = async () => {
    try {
      await updateMarkup.mutateAsync({
        markupPercent: Number(markupPercent) || 0,
        fixedMarkup: Number(fixedMarkup) || 0,
      });
      toast.success("Markup settings saved successfully");
    } catch {
      toast.error("Failed to save markup settings");
    }
  };

  const handleBackup = () => {
    // Simply opening the URL will trigger the file download
    window.location.href = "/api/settings/backup";
  };

  const openResetDialog = (type: "STOCK" | "FULL") => {
    setResetType(type);
    setConfirmText("");
    setIsDialogOpen(true);
  };

  const handleReset = async () => {
    if (confirmText !== "RESET") return;
    
    setIsResetting(true);
    try {
      const res = await fetch("/api/settings/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: resetType }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.error || "Failed to reset inventory");
      }

      toast.success("Inventory reset successfully");
      setIsDialogOpen(false);
    } catch (error: unknown) {
      const err = error as Error;
      toast.error(err.message || "An error occurred");
    } finally {
      setIsResetting(false);
    }
  };

  if (!isOwner) {
    return (
      <div className="p-8 max-w-2xl mx-auto text-center">
        <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
        <p className="text-muted-foreground">Only owners can access the settings page.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your inventory system settings and data.</p>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DatabaseBackup className="h-5 w-5" />
              Backup Database
            </CardTitle>
            <CardDescription>
              Download a complete backup of your database as a .sql file. 
              For large databases, the backup may take several seconds.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleBackup} className="w-full sm:w-auto">
              <Download className="mr-2 h-4 w-4" />
              Backup Now
            </Button>
          </CardContent>
        </Card>

        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Reset Inventory
            </CardTitle>
            <CardDescription>
              Clear stock levels and transaction history. Please create a backup first.
              This will reset the current stock of all variants to 0 and delete all movements, batches, and reservations.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="destructive" onClick={() => openResetDialog("STOCK")} className="w-full sm:w-auto">
              <Trash2 className="mr-2 h-4 w-4" />
              Reset Stock & History
            </Button>
          </CardContent>
        </Card>

        {/* Markup Settings Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DatabaseBackup className="h-5 w-5" /> {/* Re-using icon for now, could be something else like Percent or Tag */}
              Markup Settings
            </CardTitle>
            <CardDescription>
              Configure default markup values used to auto-calculate the selling price for new variants created during manual tally.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Markup Percentage (%)</label>
                <Input 
                  type="number"
                  step="0.1"
                  min="0"
                  value={markupPercent}
                  onChange={(e) => setMarkupPercentInput(e.target.value)}
                  disabled={isMarkupLoading || updateMarkup.isPending}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Fixed Markup (₱)</label>
                <Input 
                  type="number"
                  step="0.01"
                  min="0"
                  value={fixedMarkup}
                  onChange={(e) => setFixedMarkupInput(e.target.value)}
                  disabled={isMarkupLoading || updateMarkup.isPending}
                />
              </div>
            </div>
            <Button 
              onClick={handleSaveMarkup} 
              disabled={isMarkupLoading || updateMarkup.isPending}
            >
              {updateMarkup.isPending ? "Saving..." : "Save Settings"}
            </Button>
          </CardContent>
        </Card>

        <div className="pt-8">
          <h2 className="text-xl font-semibold mb-4 text-destructive">Advanced Destructive Actions</h2>
          <Card className="border-destructive bg-destructive/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <Trash2 className="h-5 w-5" />
                Full System Reset
              </CardTitle>
              <CardDescription className="text-destructive/80">
                Extremely destructive. This will delete ALL products, categories, stock levels, and transaction history. 
                Only users and settings will remain.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="destructive" onClick={() => openResetDialog("FULL")} className="w-full sm:w-auto">
                <AlertTriangle className="mr-2 h-4 w-4" />
                Delete All Data
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Are you absolutely sure?</DialogTitle>
            <DialogDescription>
              {resetType === "STOCK" 
                ? "This action cannot be undone. This will permanently delete all stock movements, batches, and reservations, and reset all current stock to 0."
                : "This action cannot be undone. This will permanently delete ALL products, categories, variants, and transaction history."}
            </DialogDescription>
          </DialogHeader>
          
          <div className="my-4 space-y-4">
            <div className="bg-destructive/10 p-3 rounded-md border border-destructive/20 text-sm text-destructive flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <p>Please ensure you have created a backup before proceeding with this action.</p>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Type <span className="font-bold select-none">RESET</span> to confirm
              </label>
              <Input 
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="RESET"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isResetting}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleReset} 
              disabled={confirmText !== "RESET" || isResetting}
            >
              {isResetting ? "Resetting..." : "Confirm Reset"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
