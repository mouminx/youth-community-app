"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateProfileInfo } from "@/actions/profile";

export function ProfileEditor({
  initialUsername,
  initialFirstName,
  initialLastName,
  initialDisplayName,
  setup,
}: {
  initialUsername: string;
  initialFirstName: string;
  initialLastName: string;
  initialDisplayName: string;
  setup: boolean;
}) {
  const router = useRouter();
  const [username, setUsername] = useState(initialUsername);
  const [firstName, setFirstName] = useState(initialFirstName);
  const [lastName, setLastName] = useState(initialLastName);
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaved(false);
    startTransition(async () => {
      const res = await updateProfileInfo(firstName, lastName, username, displayName);
      if ("error" in res) {
        setError(res.error);
      } else {
        setSaved(true);
        router.refresh();
      }
    });
  }

  return (
    <section>
      {setup && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-indigo-500/20 bg-indigo-500/10 px-4 py-3">
          <svg className="mt-0.5 h-4 w-4 shrink-0 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-indigo-300">Complete your profile before exploring your community.</p>
        </div>
      )}

      <div className="card p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.08em] text-white">Identity</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label" htmlFor="pi-username">Username</label>
            <div className="flex items-center">
              <span className="flex h-9 items-center rounded-l border border-r-0 border-white/[0.1] bg-white/[0.03] px-3 text-sm text-gray-500">@</span>
              <input
                id="pi-username"
                className="input rounded-l-none"
                placeholder="yourhandle"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                maxLength={20}
                minLength={3}
                required
              />
            </div>
            <p className="mt-1 text-xs text-gray-600">3–20 characters: letters, numbers, underscores. Global across all communities.</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="pi-first">First name</label>
              <input
                id="pi-first"
                className="input"
                placeholder="First"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                maxLength={50}
              />
            </div>
            <div>
              <label className="label" htmlFor="pi-last">Last name</label>
              <input
                id="pi-last"
                className="input"
                placeholder="Last"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                maxLength={50}
              />
            </div>
          </div>

          <div>
            <label className="label" htmlFor="pi-display">Nickname / Display name <span className="text-gray-700 font-normal">(optional)</span></label>
            <input
              id="pi-display"
              className="input"
              placeholder="How you want to appear by default"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={50}
            />
          </div>

          <div className="flex items-start gap-2 rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-2.5">
            <svg className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <p className="text-xs text-gray-600">
              Your real name stays private. It will only be shown if the community owner selects &ldquo;Full Name&rdquo; or &ldquo;First + Last Initial&rdquo; as their display setting.
            </p>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2.5">
              <svg className="mt-0.5 h-4 w-4 shrink-0 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          <div className="flex items-center gap-3">
            <button type="submit" disabled={isPending} className="btn-primary btn-sm">
              {isPending ? "Saving…" : "Save Identity"}
            </button>
            {saved && <span className="text-xs text-emerald-400">Saved!</span>}
          </div>
        </form>
      </div>
    </section>
  );
}
