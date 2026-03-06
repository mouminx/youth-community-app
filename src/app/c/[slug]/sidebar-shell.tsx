"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ThemeApplier } from "./theme-applier";

export function SidebarShell({
  communityName,
  themeKey,
  sidebarContent,
  children,
}: {
  communityName: string;
  themeKey: string;
  sidebarContent: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close drawer on navigation
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <div className="flex h-screen flex-col overflow-hidden md:flex-row">
      <ThemeApplier themeKey={themeKey} />

      {/* Mobile top bar */}
      <div className="flex shrink-0 items-center gap-3 border-b border-white/[0.06] bg-[var(--sidebar-bg)] px-4 py-3 md:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex h-8 w-8 items-center justify-center rounded text-gray-400 hover:bg-white/[0.06] hover:text-white transition-colors"
          aria-label="Open navigation"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" />
          </svg>
        </button>
        <span className="text-sm font-semibold text-white truncate">{communityName}</span>
      </div>

      {/* Content row */}
      <div className="flex flex-1 overflow-hidden">
        {/* Backdrop */}
        {open && (
          <div
            className="fixed inset-0 z-40 bg-black/60 md:hidden"
            onClick={() => setOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={[
            "fixed inset-y-0 left-0 z-50 flex w-60 shrink-0 flex-col border-r border-white/[0.06] bg-[var(--sidebar-bg)] transition-transform duration-200 ease-in-out",
            "md:relative md:inset-auto md:translate-x-0",
            open ? "translate-x-0" : "-translate-x-full",
          ].join(" ")}
        >
          {/* Close button — mobile only */}
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="absolute right-3 top-3.5 z-10 flex h-7 w-7 items-center justify-center rounded text-gray-600 hover:bg-white/[0.06] hover:text-gray-300 transition-colors md:hidden"
            aria-label="Close navigation"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {sidebarContent}
        </aside>

        {/* Main content */}
        <main className="flex flex-1 flex-col overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
