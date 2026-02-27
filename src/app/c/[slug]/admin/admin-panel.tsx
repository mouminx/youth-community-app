"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSeason, setActiveSeason, createBattlePassTier } from "@/actions/battlepass";
import { createBadge } from "@/actions/badges";

type Season = {
  id: string;
  name: string;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
  battle_pass_tiers: { id: string; tier_number: number; xp_required: number; reward_label: string }[];
};

export function AdminPanel({ communityId, slug, seasons }: { communityId: string; slug: string; seasons: Season[] }) {
  const router = useRouter();
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="border-b border-white/[0.06] px-8 py-5">
        <h1 className="text-lg font-semibold text-white">Admin</h1>
        <p className="mt-0.5 text-sm text-gray-600">Manage seasons, tiers, and badges</p>
      </div>
      <div className="px-8 py-6 space-y-8">
        <section>
          <div className="mb-4"><h2 className="text-sm font-semibold text-white">Seasons</h2></div>
          <CreateSeasonForm communityId={communityId} onDone={() => router.refresh()} />
          {seasons.length === 0 ? (
            <p className="mt-4 text-sm text-gray-600">No seasons yet. Create one above.</p>
          ) : (
            <div className="mt-4 space-y-4">
              {seasons.map((s) => (
                <SeasonCard key={s.id} season={s} communityId={communityId} onDone={() => router.refresh()} />
              ))}
            </div>
          )}
        </section>
        <section>
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-white">Badges</h2>
            <p className="mt-0.5 text-xs text-gray-600">Create badges that mentors can award (+25 XP each)</p>
          </div>
          <CreateBadgeForm communityId={communityId} onDone={() => router.refresh()} />
        </section>
      </div>
    </div>
  );
}

function CreateSeasonForm({ communityId, onDone }: { communityId: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await createSeason(communityId, { name, starts_at: new Date(startsAt).toISOString(), ends_at: new Date(endsAt).toISOString() });
    if (res.error) setError(res.error);
    else { setName(""); setStartsAt(""); setEndsAt(""); setOpen(false); onDone(); }
    setLoading(false);
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-primary btn-sm">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        New Season
      </button>
    );
  }

  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm font-semibold text-white">New Season</p>
        <button onClick={() => setOpen(false)} className="text-gray-600 hover:text-gray-400 transition-colors">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="label">Season name</label>
          <input type="text" placeholder="e.g. Spring 2026" required value={name} onChange={(e) => setName(e.target.value)} className="input" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Start date</label>
            <input type="date" required value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className="input" />
          </div>
          <div>
            <label className="label">End date</label>
            <input type="date" required value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className="input" />
          </div>
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <div className="flex gap-2">
          <button type="submit" disabled={loading} className="btn-primary btn-sm">{loading ? "Creating…" : "Create Season"}</button>
          <button type="button" onClick={() => setOpen(false)} className="btn-ghost btn-sm">Cancel</button>
        </div>
      </form>
    </div>
  );
}

function SeasonCard({ season, communityId, onDone }: { season: Season; communityId: string; onDone: () => void }) {
  const [tierNum, setTierNum] = useState("");
  const [xpReq, setXpReq] = useState("");
  const [reward, setReward] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showTierForm, setShowTierForm] = useState(false);

  async function handleActivate() {
    setLoading(true);
    const res = await setActiveSeason(communityId, season.id);
    if (res.error) setError(res.error);
    else onDone();
    setLoading(false);
  }

  async function handleAddTier(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await createBattlePassTier(communityId, season.id, { tier_number: parseInt(tierNum), xp_required: parseInt(xpReq), reward_label: reward });
    if (res.error) setError(res.error);
    else { setTierNum(""); setXpReq(""); setReward(""); setShowTierForm(false); onDone(); }
    setLoading(false);
  }

  const sortedTiers = [...season.battle_pass_tiers].sort((a, b) => a.tier_number - b.tier_number);

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="font-medium text-white">{season.name}</p>
          <p className="text-xs text-gray-600">{new Date(season.starts_at).toLocaleDateString()} – {new Date(season.ends_at).toLocaleDateString()}</p>
        </div>
        {season.is_active ? (
          <span className="badge bg-emerald-500/15 text-emerald-300">Active</span>
        ) : (
          <button onClick={handleActivate} disabled={loading} className="btn-ghost btn-sm text-xs">Set Active</button>
        )}
      </div>
      {sortedTiers.length > 0 && (
        <div className="mb-3 space-y-1">
          {sortedTiers.map((t) => (
            <div key={t.id} className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2 text-sm">
              <span className="text-gray-400">Tier {t.tier_number}{t.reward_label ? ": " + t.reward_label : ""}</span>
              <span className="text-xs text-gray-600">{t.xp_required} XP</span>
            </div>
          ))}
        </div>
      )}
      {showTierForm ? (
        <form onSubmit={handleAddTier} className="space-y-2">
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="label text-xs">Tier #</label>
              <input type="number" placeholder="1" required min={1} value={tierNum} onChange={(e) => setTierNum(e.target.value)} className="input py-1.5 text-sm" />
            </div>
            <div>
              <label className="label text-xs">XP required</label>
              <input type="number" placeholder="100" required min={0} value={xpReq} onChange={(e) => setXpReq(e.target.value)} className="input py-1.5 text-sm" />
            </div>
            <div>
              <label className="label text-xs">Reward</label>
              <input type="text" placeholder="Badge, Role…" value={reward} onChange={(e) => setReward(e.target.value)} className="input py-1.5 text-sm" />
            </div>
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={loading} className="btn-primary btn-sm text-xs">{loading ? "…" : "Add Tier"}</button>
            <button type="button" onClick={() => setShowTierForm(false)} className="btn-ghost btn-sm text-xs">Cancel</button>
          </div>
        </form>
      ) : (
        <button onClick={() => setShowTierForm(true)} className="btn-ghost btn-sm text-xs">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Tier
        </button>
      )}
    </div>
  );
}

function CreateBadgeForm({ communityId, onDone }: { communityId: string; onDone: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess(false);
    const res = await createBadge(communityId, { name, description });
    if (res.error) setError(res.error);
    else { setName(""); setDescription(""); setSuccess(true); onDone(); }
    setLoading(false);
  }

  return (
    <div className="card p-5">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Badge name</label>
            <input type="text" placeholder="e.g. Top Contributor" required value={name} onChange={(e) => setName(e.target.value)} className="input" />
          </div>
          <div>
            <label className="label">Description <span className="text-gray-700">(optional)</span></label>
            <input type="text" placeholder="What earns this badge?" value={description} onChange={(e) => setDescription(e.target.value)} className="input" />
          </div>
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        {success && <p className="text-sm text-emerald-400">Badge created!</p>}
        <button type="submit" disabled={loading} className="btn-primary btn-sm">{loading ? "Creating…" : "Create Badge"}</button>
      </form>
    </div>
  );
}
