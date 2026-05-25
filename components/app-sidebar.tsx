"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Package,
  ArrowLeftRight,
  FolderTree,
  Download,
  Menu,
  Zap,
  BarChart3,
  LogOut,
  User,
  Layers,
} from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/stock", label: "Quick Stock", icon: Zap },
  { href: "/products", label: "Products", icon: Package },
  { href: "/batches", label: "Batches", icon: Layers },
  { href: "/movements", label: "Movements", icon: ArrowLeftRight },
  { href: "/categories", label: "Categories", icon: FolderTree },
  { href: "/export", label: "Export", icon: Download },
];

function NavLink({ href, label, icon: Icon }: { href: string; label: string; icon: any }) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 transition-colors",
        isActive
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      )}
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
    </Link>
  );
}

function UserSection() {
  const { data: session } = useSession();

  if (!session?.user) return null;

  return (
    <div className="border-t p-4">
      <div className="flex items-center gap-3 mb-3">
        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
          <User className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{session.user.name}</p>
          <p className="text-xs text-muted-foreground truncate">{session.user.email}</p>
        </div>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="w-full"
        onClick={() => signOut({ callbackUrl: "/" })}
      >
        <LogOut className="mr-2 h-4 w-4" />
        Sign out
      </Button>
    </div>
  );
}

export function AppSidebar() {
  return (
    <>
      {/* Mobile */}
      <Sheet>
        <SheetTrigger className="lg:hidden fixed left-4 top-4 z-50 inline-flex h-9 w-9 items-center justify-center rounded-md border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground">
          <Menu className="h-4 w-4" />
          <span className="sr-only">Toggle menu</span>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0">
          <div className="flex h-full flex-col border-r bg-background">
            <div className="border-b p-6">
              <h1 className="text-lg font-semibold">J&R Inventory</h1>
            </div>
            <nav className="flex-1 space-y-1 p-4">
              {navItems.map((item) => (
                <NavLink key={item.href} {...item} />
              ))}
            </nav>
            <UserSection />
          </div>
        </SheetContent>
      </Sheet>

      {/* Desktop */}
      <div className="hidden lg:flex h-screen w-64 flex-col border-r bg-background fixed left-0 top-0">
        <div className="border-b p-6">
          <h1 className="text-lg font-semibold">J&R Inventory</h1>
        </div>
        <nav className="flex-1 space-y-1 p-4">
          {navItems.map((item) => (
            <NavLink key={item.href} {...item} />
          ))}
        </nav>
        <UserSection />
      </div>
    </>
  );
}
