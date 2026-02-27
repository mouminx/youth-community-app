"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createCommunity } from "@/actions/community";

export function CreateCommunityForm() {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  function handleNameChange(value: string) {
    setName(value);
    setSlug(
      value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 30)
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const result = await createCommunity(name, slug);
    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }
    router.push(`/c/${result.data!.slug}`);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="c-name">Community name</label>
          <input
            id="c-name"
            type="text"
            placeholder="My Awesome Community"
            required
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            className="input"
          />
        </div>
        <div>
          <label className="label" htmlFor="c-slug">URL slug</label>
          <div className="flex items-center rounded-lg border border-white/[0.08] bg-[#18181f] transition-colors focus-within:border-indigo-500/60 focus-within:ring-1 focus-within:ring-indigo-500/30">
            <span className="pl-3 text-sm text-gray-600">/</span>
            <input
              id="c-slug"
              type="text"
              placeholder="my-community"
              required
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
              pattern="^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$"
              title="3–30 chars, lowercase letters/numbers/hyphens"
              className="flex-1 bg-transparent px-1.5 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {error && (
        <p className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          {error}
        </p>
      )}

      <div className="flex items-center justify-between pt-1">
        <p className="text-xs text-gray-600">You'll be the owner with full access.</p>
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? "Creating…" : "Create community"}
        </button>
      </div>
    </form>
  );
}
