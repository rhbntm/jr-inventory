import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Package, BarChart3, Shield } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/50">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="h-6 w-6 text-primary" />
            <span className="font-bold text-xl">J&R Inventory</span>
          </div>
          <Link href="/login">
            <Button>Sign In</Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="container mx-auto px-4 py-24 text-center">
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
          Inventory Management
          <span className="text-primary block">Made Simple</span>
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
          Track products, manage stock levels, and monitor movements — all in one place.
        </p>
        <div className="flex gap-4 justify-center">
          <Link href="/login">
            <Button size="lg">Get Started</Button>
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-4 py-16">
        <div className="grid md:grid-cols-3 gap-8">
          <div className="p-6 rounded-lg border bg-card">
            <Package className="h-10 w-10 text-primary mb-4" />
            <h3 className="font-semibold text-lg mb-2">Product Management</h3>
            <p className="text-muted-foreground">
              Organize products with categories, variants, and SKUs. Track cost and pricing.
            </p>
          </div>
          <div className="p-6 rounded-lg border bg-card">
            <BarChart3 className="h-10 w-10 text-primary mb-4" />
            <h3 className="font-semibold text-lg mb-2">Stock Analytics</h3>
            <p className="text-muted-foreground">
              Monitor stock levels, track movements, and get low stock alerts.
            </p>
          </div>
          <div className="p-6 rounded-lg border bg-card">
            <Shield className="h-10 w-10 text-primary mb-4" />
            <h3 className="font-semibold text-lg mb-2">Secure Access</h3>
            <p className="text-muted-foreground">
              Role-based access control with Google OAuth and email authentication.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} J&R Inventory. All rights reserved.
        </div>
      </footer>
    </div>
  );
}

