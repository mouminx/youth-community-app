"use client";

import { useState, useEffect } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

const TEST_USERS = [
  { email: "owner@test.dev",   password: "Test1234!", label: "Alex Chen",    role: "owner"  },
  { email: "admin@test.dev",   password: "Test1234!", label: "Jordan Lee",   role: "admin"  },
  { email: "mentor@test.dev",  password: "Test1234!", label: "Sam Rivera",   role: "mentor" },
  { email: "member@test.dev",  password: "Test1234!", label: "Casey Park",   role: "member" },
  { email: "member2@test.dev", password: "Test1234!", label: "Riley Nguyen", role: "member" },
] as const;

const ROLE_COLOR: Record<string, string> = {
  owner:  "text-amber-400",
  admin:  "text-purple-400",
  mentor: "text-blue-400",
  member: "text-gray-500",
};

export function DevUserSwitcher() {
  const [open, setOpen] = useState(false);
  const [currentEmail, setCurrentEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    supabase.auth.getUser().then(({ data }) => {
      setCurrentEmail(data.user?.email ?? null);
    });
  }, []);

  async function switchTo(user: (typeof TEST_USERS)[number]) {
    if (loading) return;
    setLoading(user.email);
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: user.password,
    });
    if (error) {
      alert(`Switch failed: ${error.message}\n\nRun 'npm run seed' first.`);
      setLoading(null);
    } else {
      window.location.href = "/communities";
    }
  }

  async function signOut() {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    setCurrentEmail(null);
    window.location.href = "/login";
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 select-none font-mono text-xs">
      {open && (
        <div className="mb-2 w-60 overflow-hidden rounded-xl border border-white/10 bg-[#0e0e18] shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/[0.06] px-3 py-2">
            <span className="text-[10px] uppercase tracking-widest text-gray-600">
              Dev · Switch User
            </span>
            {currentEmail && (
              <button
                onClick={signOut}
                className="text-[10px] text-gray-600 hover:text-red-400 transition-colors"
              >
                sign out
              </button>
            )}
          </div>

          {/* User list */}
          <div className="p-1.5">
            {TEST_USERS.map((u) => {
              const isActive = currentEmail === u.email;
              const isLoading = loading === u.email;
              return (
                <button
                  key={u.email}
                  onClick={() => switchTo(u)}
                  disabled={loading !== null || isActive}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors ${
                    isActive
                      ? "bg-white/[0.06] cursor-default"
                      : "hover:bg-white/[0.05] cursor-pointer"
                  } disabled:opacity-60`}
                >
                  {/* Status dot */}
                  <span
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                      isLoading
                        ? "animate-pulse bg-indigo-400"
                        : isActive
                        ? "bg-emerald-400"
                        : "bg-white/10"
                    }`}
                  />

                  {/* Name */}
                  <span className={`flex-1 truncate ${isActive ? "text-white" : "text-gray-400"}`}>
                    {u.label}
                  </span>

                  {/* Role badge */}
                  <span className={`shrink-0 ${ROLE_COLOR[u.role]}`}>{u.role}</span>
                </button>
              );
            })}
          </div>

          {/* Current user footer */}
          {currentEmail && (
            <div className="border-t border-white/[0.06] px-3 py-2 text-[10px] text-gray-600 truncate">
              {currentEmail}
            </div>
          )}
        </div>
      )}

      {/* Toggle button */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="ml-auto flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#0e0e18] px-2.5 py-1.5 text-gray-500 shadow-lg transition-colors hover:border-white/20 hover:text-white"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
        {open ? "close" : "dev"}
      </button>
    </div>
  );
}
