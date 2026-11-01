"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  ArrowLeftRight,
  Boxes,
  CalendarCheck2,
  ChartColumn,
  Check,
  Download,
  Home,
  LogOut,
  Menu,
  Package,
  PackageOpen,
  Radio,
  Settings,
  SlidersHorizontal,
  Tags,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useReservationCounts } from "@/lib/hooks";
import { DEFAULT_SHORTCUTS, MAX_SHORTCUTS, parseShortcuts, toggleShortcut } from "@/lib/shortcuts";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

const navGroups: { label?: string; items: { href: string; label: string; icon: LucideIcon }[] }[] = [
  {
    items: [
      { href: "/dashboard", label: "Today", icon: Home },
      { href: "/live", label: "Live", icon: Radio },
      { href: "/reservations", label: "Reservations", icon: CalendarCheck2 },
    ],
  },
  {
    label: "Inventory",
    items: [
      { href: "/inventory", label: "Stock", icon: Boxes },
      { href: "/products", label: "Products", icon: Package },
      { href: "/batches", label: "Batches", icon: PackageOpen },
      { href: "/movements", label: "Movements", icon: ArrowLeftRight },
      { href: "/categories", label: "Categories", icon: Tags },
    ],
  },
  {
    label: "Reports",
    items: [
      { href: "/analytics", label: "Analytics", icon: ChartColumn },
      { href: "/export", label: "Export", icon: Download },
    ],
  },
  { items: [{ href: "/settings", label: "Settings", icon: Settings }] },
];

const allNavItems = navGroups.flatMap((group) => group.items);
const allNavHrefs = allNavItems.map((item) => item.href);

const SHORTCUTS_KEY = "jr-phone-shortcuts";
const SHORTCUTS_CHANGED = "jr-phone-shortcuts-changed";

function subscribeToShortcuts(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(SHORTCUTS_CHANGED, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(SHORTCUTS_CHANGED, onChange);
  };
}

function readSavedShortcuts() {
  try {
    return window.localStorage.getItem(SHORTCUTS_KEY);
  } catch {
    return null;
  }
}

/** Saved per device, since the point is to fit how each phone gets used. */
function saveShortcuts(shortcuts: string[] | null) {
  try {
    if (shortcuts) {
      window.localStorage.setItem(SHORTCUTS_KEY, JSON.stringify(shortcuts));
    } else {
      window.localStorage.removeItem(SHORTCUTS_KEY);
    }
  } catch {
    // Private browsing can refuse storage. The bar just keeps what it had.
  }
  window.dispatchEvent(new Event(SHORTCUTS_CHANGED));
}

function useShortcuts() {
  // The server can't see browser storage, so the first render always uses the defaults.
  const saved = useSyncExternalStore(subscribeToShortcuts, readSavedShortcuts, () => null);
  return useMemo(() => parseShortcuts(saved, allNavHrefs), [saved]);
}

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

function ShortcutEditor({ shortcuts, onDone }: { shortcuts: string[]; onDone: () => void }) {
  const full = shortcuts.length >= MAX_SHORTCUTS;
  const isDefault = shortcuts.join() === DEFAULT_SHORTCUTS.join();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <p aria-live="polite" className="px-6 pb-3 text-sm text-[#c4cad0]">
        {full
          ? `${MAX_SHORTCUTS} of ${MAX_SHORTCUTS} chosen. Untick one to swap it.`
          : `${shortcuts.length} of ${MAX_SHORTCUTS} chosen.`}{" "}
        They appear in the order you pick them.
      </p>
      <ul className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-3 pb-3">
        {allNavItems.map(({ href, label, icon: Icon }) => {
          const position = shortcuts.indexOf(href);
          const chosen = position !== -1;
          const locked = (full && !chosen) || (chosen && shortcuts.length === 1);
          return (
            <li key={href}>
              <button
                type="button"
                role="checkbox"
                aria-checked={chosen}
                disabled={locked}
                onClick={() => saveShortcuts(toggleShortcut(shortcuts, href))}
                className={cn(
                  "flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-lg px-3 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sidebar-ring disabled:cursor-not-allowed",
                  chosen ? "bg-sidebar-accent font-semibold" : "hover:bg-sidebar-accent",
                  locked && !chosen && "text-[#a8b0b8]"
                )}
              >
                <Icon className="size-5 shrink-0" aria-hidden="true" />
                <span className="flex-1">{label}</span>
                {chosen && (
                  <span className="flex items-center gap-1 font-mono text-xs">
                    {position + 1}
                    <Check className="size-4" aria-hidden="true" />
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      <div className="flex gap-2 border-t border-sidebar-border p-3">
        <button
          type="button"
          disabled={isDefault}
          onClick={() => saveShortcuts(null)}
          className="min-h-11 flex-1 cursor-pointer rounded-lg px-3 text-sm text-[#c4cad0] hover:bg-sidebar-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sidebar-ring disabled:cursor-not-allowed disabled:opacity-50"
        >
          Reset
        </button>
        <button
          type="button"
          onClick={onDone}
          className="min-h-11 flex-1 cursor-pointer rounded-lg bg-sidebar-primary px-3 text-sm font-semibold text-sidebar-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sidebar-ring"
        >
          Done
        </button>
      </div>
    </div>
  );
}

function PhoneBar() {
  const isActive = useIsActive();
  const [menuOpen, setMenuOpen] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const shortcuts = useShortcuts();
  const barItems = shortcuts.flatMap((href) => allNavItems.filter((item) => item.href === href));

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 grid gap-1 bg-sidebar px-1 pt-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] text-sidebar-foreground lg:hidden"
      style={{ gridTemplateColumns: `repeat(${barItems.length + 1}, minmax(0, 1fr))` }}
    >
      {barItems.map(({ href, label, icon: Icon }) => {
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
      <Sheet
        open={menuOpen}
        onOpenChange={(open) => {
          setMenuOpen(open);
          if (!open) setCustomizing(false);
        }}
      >
        <SheetTrigger className={cn(phoneBarLink, "cursor-pointer")}>
          <Menu className="size-5" aria-hidden="true" />
          More
        </SheetTrigger>
        <SheetContent side="right" className="w-72 gap-0 border-sidebar-border bg-sidebar p-0 text-sidebar-foreground">
          <SheetTitle className="px-6 py-5 text-base font-bold text-sidebar-foreground">
            {customizing ? "Bottom bar shortcuts" : "J&R Inventory"}
          </SheetTitle>
          {customizing ? (
            <ShortcutEditor shortcuts={shortcuts} onDone={() => setCustomizing(false)} />
          ) : (
            <>
              <Navigation onNavigate={() => setMenuOpen(false)} />
              <div className="px-3 pb-2">
                <button
                  type="button"
                  onClick={() => setCustomizing(true)}
                  className="flex min-h-10 w-full cursor-pointer items-center gap-2 rounded-lg px-3 text-sm text-[#c4cad0] transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sidebar-ring"
                >
                  <SlidersHorizontal className="size-4" aria-hidden="true" />
                  Customize shortcuts
                </button>
              </div>
              <UserSection />
            </>
          )}
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
