"use client";

import { usePathname } from "next/navigation";
import { AppSidebar } from "@/components/app-sidebar";
import { ErrorBoundary } from "@/components/error-boundary";

/** Screens that stand alone: public pages, and Live, which needs the whole window. */
const ROUTES_WITHOUT_NAVIGATION = new Set(["/", "/login", "/live", "/offline"]);

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (ROUTES_WITHOUT_NAVIGATION.has(pathname)) {
    return <ErrorBoundary>{children}</ErrorBoundary>;
  }

  return (
    <div className="flex min-h-dvh">
      <AppSidebar />
      {/* Bottom padding keeps content clear of the phone navigation bar. */}
      <main className="min-w-0 flex-1 p-4 pb-24 lg:ml-60 lg:p-8">
        <ErrorBoundary>{children}</ErrorBoundary>
      </main>
    </div>
  );
}
