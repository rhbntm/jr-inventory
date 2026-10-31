"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { CalendarCheck2, Home, LogOut, Menu, Radio } from "lucide-react";
import { cn } from "@/lib/utils";
import { useReservationCounts } from "@/lib/hooks";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

const navGroups: { label?: string; items: { href: string; label: string }[] }[] = [
  {
    items: [
      { href: "/dashboard", label: "Today" },
      { href: "/live", label: "Live" },
      { href: "/reservations", label: "Reservations" },
    ],
  },
  {
    label: "Inventory",
    items: [
      { href: "/products", label: "Products" },
      { href: "/batches", label: "Batches" },
      { href: "/movements", label: "Movements" },
      { href: "/categories", label: "Categories" },
    ],
  },
  {
    label: "Reports",
    items: [
      { href: "/analytics", label: "Analytics" },
      { href: "/export", label: "Export" },
    ],
  },
  { items: [{ href: "/settings", label: "Settings" }] },
];

const phoneBarItems = [
  { href: "/dashboard", label: "Today", icon: Home },
  { href: "/live", label: "Live", icon: Radio },
  { href: "/reservations", label: "Reservations", icon: CalendarCheck2 },
];

function useIsActive() {
  const pathname = usePathname();
  return (href: string) => pathname === href || pathname.startsWith(`${href}/`);
}

function Navigation({ onNavigate }: { onNavigate?: () => void }) {
  const isActive = useIsActive();
  const { data: reservations } = useReservationCounts();
  const toShip = reservations?.counts.RESERVED ?? 0;

  return (
    <nav aria-label="Main" className="flex-1 space-y-6 overflow-y-auto px-3 pb-4">
      {navGroups.map((group, index) => (
        <div key={group.label ?? index} className="space-y-0.5">
          {group.label && <p className="px-3 pb-1.5 text-xs text-[#a8b0b8]">{group.label}</p>}
          {group.items.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-10 items-center justify-between rounded-lg px-3 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sidebar-ring",
                  active
                    ? "bg-sidebar-primary font-semibold text-sidebar-primary-foreground"
                    : "hover:bg-sidebar-accent"
                )}
              >
                {item.label}
                {item.href === "/reservations" && toShip > 0 && (
                  <span
                    className={cn("font-mono text-xs", active ? "text-muted-foreground" : "text-[#c4cad0]")}
                    aria-label={`${toShip} to ship`}
                  >
                    {toShip}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

function UserSection() {
  const { data: session } = useSession();

  if (!session?.user) return null;

  return (
    <div className="border-t border-sidebar-border p-3">
      <div className="px-3 py-2">
        <p className="truncate text-sm font-medium">{session.user.name}</p>
        <p className="truncate text-xs text-[#a8b0b8]">{session.user.email}</p>
      </div>
      <button
        type="button"
        onClick={() => signOut({ callbackUrl: "/" })}
        className="flex min-h-10 w-full cursor-pointer items-center gap-2 rounded-lg px-3 text-sm text-[#c4cad0] transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sidebar-ring"
      >
        <LogOut className="size-4" aria-hidden="true" />
        Sign out
      </button>
    </div>
  );
}

const phoneBarLink =
  "flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-lg text-xs font-medium focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-sidebar-ring";

function PhoneBar() {
  const isActive = useIsActive();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 gap-1 bg-sidebar px-1 pt-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] text-sidebar-foreground lg:hidden">
      {phoneBarItems.map(({ href, label, icon: Icon }) => {
        const active = isActive(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(phoneBarLink, active && "bg-sidebar-primary font-semibold text-sidebar-primary-foreground")}
          >
            <Icon className="size-5" aria-hidden="true" />
            {label}
          </Link>
        );
      })}
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetTrigger className={cn(phoneBarLink, "cursor-pointer")}>
          <Menu className="size-5" aria-hidden="true" />
          More
        </SheetTrigger>
        <SheetContent side="right" className="w-72 gap-0 border-sidebar-border bg-sidebar p-0 text-sidebar-foreground">
          <SheetTitle className="px-6 py-5 text-base font-bold text-sidebar-foreground">J&amp;R Inventory</SheetTitle>
          <Navigation onNavigate={() => setMenuOpen(false)} />
          <UserSection />
        </SheetContent>
      </Sheet>
    </div>
  );
}

export function AppSidebar() {
  return (
    <>
      <PhoneBar />
      <aside className="fixed top-0 left-0 hidden h-dvh w-60 flex-col bg-sidebar text-sidebar-foreground lg:flex">
        <p className="px-6 py-5 text-base font-bold">J&amp;R Inventory</p>
        <Navigation />
        <UserSection />
      </aside>
    </>
  );
}
