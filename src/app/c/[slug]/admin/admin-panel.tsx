"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSeason, setActiveSeason, updateSeason, configureSeasonLevels } from "@/actions/battlepass";
import { createInviteCode, deactivateInviteCode } from "@/actions/invites";
import { createBadge } from "@/actions/badges";
import { createTrophy, awardTrophy, type TrophyWithAwards } from "@/actions/trophies";
import { awardCurrency } from "@/actions/currency";
import { updateCommunityTheme } from "@/actions/theme";
import { THEME_KEYS, type ThemeKey } from "@/lib/themes";
import {
  requestPermission,
  reviewPermissionRequest,
  revokePermission,
  changeMemberRole,
  promoteToAdmin,
  demoteAdmin,
  grantManualXp,
  awardUserBadge,
  updateNameDisplayMode,
} from "@/actions/management";
import type { CommunityRole, GrantablePermission } from "@/lib/rbac";

function Lock({ className = "" }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="5" y="11" width="14" height="10" rx="2" /><path strokeLinecap="round" strokeLinejoin="round" d="M8 11V8a4 4 0 118 0v3" /></svg>;
}

function Medal({ className = "" }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 3h8l-1.5 5h-5L8 3zm4 7a6 6 0 110 12 6 6 0 010-12z" /></svg>;
}

// ── Types ──────────────────────────────────────────────────────────────────────

type Season = {
  id: string;
  name: string;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
  battle_pass_tiers: { id: string; tier_number: number; xp_required: number; reward_label: string }[];
};

type Badge = { id: string; name: string; description: string };

type Member = {
  id: string;
  user_id: string;
  role: CommunityRole;
  profiles: { display_name: string } | null;
};

type PermReq = {
  id: string;
  requester_id: string;
  permission: string;
  requester_note: string;
  created_at: string;
};

type Grant = {
  id: string;
  user_id: string;
  permission: string;
  granted_at: string;
};

// ── Constants ──────────────────────────────────────────────────────────────────

const PERM_LABEL: Record<GrantablePermission, string> = {
  manage_seasons: "Manage Seasons & The Ladder",
  manage_badges: "Manage Badges",
  manage_channels: "Manage Channels",
  manage_members: "Manage Members",
};

const ROLE_COLORS: Record<CommunityRole, string> = {
  owner: "text-amber-300 bg-amber-500/15 ring-1 ring-amber-500/30",
  admin: "text-purple-300 bg-purple-500/15 ring-1 ring-purple-500/30",
  mentor: "text-blue-300 bg-blue-500/15 ring-1 ring-blue-500/30",
  member: "text-gray-400 bg-white/[0.07] ring-1 ring-white/10",
};

function displayName(members: Member[], userId: string) {
  const m = members.find((x) => x.user_id === userId);
  const name = m?.profiles?.display_name;
  return name && name.trim() ? name : userId.slice(0, 8) + "…";
}

// ── ManagementPanel ────────────────────────────────────────────────────────────

interface Props {
  communityId: string;
  slug: string;
  role: CommunityRole;
  grantedPermissions: GrantablePermission[];
  myPendingRequests: GrantablePermission[];
  seasons: Season[];
  badges: Badge[];
  members: Member[];
  trophies: TrophyWithAwards[];
  permissionRequests: PermReq[];
  grants: Grant[];
  inviteCodes: InviteCode[];
  currentTheme: string;
  currentDisplayMode: string;
}

type InviteCode = {
  id: string;
  code: string;
  label: string | null;
  use_count: number;
  is_active: boolean;
  created_at: string;
};

type TabId = "seasons" | "badges" | "members" | "users" | "trophies" | "controls" | "invites" | "theme";

export function ManagementPanel({
  communityId,
  slug,
  role,
  grantedPermissions,
  myPendingRequests,
  seasons,
  badges,
  members,
  trophies,
  permissionRequests,
  grants,
  inviteCodes,
  currentTheme,
  currentDisplayMode,
}: Props) {
  const router = useRouter();
  const isAdmin = role === "owner" || role === "admin";
  const isOwner = role === "owner";
  const [activeTab, setActiveTab] = useState<TabId>("seasons");

  const tabs: { id: TabId; label: string }[] = [
    { id: "seasons", label: "Seasons" },
    { id: "badges", label: "Badges" },
    { id: "members", label: "Members" },
    { id: "users", label: "Users" },
    ...(isAdmin ? [{ id: "trophies" as TabId, label: "Trophies" }] : []),
    ...(isAdmin ? [{ id: "controls" as TabId, label: "Controls" }] : []),
    ...(isAdmin ? [{ id: "invites" as TabId, label: "Invites" }] : []),
    ...(isOwner ? [{ id: "theme" as TabId, label: "Theme" }] : []),
  ];

  function refresh() {
    router.refresh();
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header */}
      <div className="border-b border-white/[0.06] px-8 py-5">
        <h1 className="text-lg font-semibold text-white">Management</h1>
        <div className="mt-1.5 flex items-center gap-2">
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${ROLE_COLORS[role]}`}>
            {role}
          </span>
          {!isAdmin && grantedPermissions.length > 0 && (
            <span className="text-xs text-gray-600">
              {grantedPermissions.length} extra permission{grantedPermissions.length !== 1 ? "s" : ""} granted
            </span>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div className="border-b border-white/[0.06] px-8">
        <div className="flex">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`-mb-px border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === t.id
                  ? "border-violet-500 text-violet-300"
                  : "border-transparent text-gray-500 hover:text-gray-300"
              }`}
            >
              {t.label}
              {t.id === "controls" && permissionRequests.length > 0 && (
                <span className="ml-1.5 rounded-full bg-violet-500/25 px-1.5 py-0.5 text-[10px] font-bold text-violet-300">
                  {permissionRequests.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="px-8 py-6">
        {activeTab === "seasons" && (
          <PermissionGate
            communityId={communityId}
            permission="manage_seasons"
            hasPermission={grantedPermissions.includes("manage_seasons")}
            hasPending={myPendingRequests.includes("manage_seasons")}
          >
            <SeasonsSection communityId={communityId} seasons={seasons} onDone={refresh} />
          </PermissionGate>
        )}
        {activeTab === "badges" && (
          <PermissionGate
            communityId={communityId}
            permission="manage_badges"
            hasPermission={grantedPermissions.includes("manage_badges")}
            hasPending={myPendingRequests.includes("manage_badges")}
          >
            <BadgesSection communityId={communityId} badges={badges} onDone={refresh} />
          </PermissionGate>
        )}
        {activeTab === "members" && (
          <PermissionGate
            communityId={communityId}
            permission="manage_members"
            hasPermission={grantedPermissions.includes("manage_members")}
            hasPending={myPendingRequests.includes("manage_members")}
          >
            <MembersSection communityId={communityId} members={members} currentRole={role} onDone={refresh} />
          </PermissionGate>
        )}
        {activeTab === "users" && (
          <UsersSection
            communityId={communityId}
            members={members}
            badges={badges}
            onDone={refresh}
          />
        )}
        {activeTab === "trophies" && isAdmin && (
          <TrophiesSection
            communityId={communityId}
            trophies={trophies}
            members={members}
            onDone={refresh}
          />
        )}
        {activeTab === "controls" && isAdmin && (
          <ControlsSection
            communityId={communityId}
            permissionRequests={permissionRequests}
            grants={grants}
            members={members}
            isOwner={isOwner}
            onDone={refresh}
          />
        )}
        {activeTab === "invites" && isAdmin && (
          <InvitesSection communityId={communityId} slug={slug} inviteCodes={inviteCodes} onDone={refresh} />
        )}
        {activeTab === "theme" && isOwner && (
          <div className="space-y-6">
            <ThemeSection
              communityId={communityId}
              currentTheme={currentTheme}
              onDone={refresh}
            />
            <DisplayModeSection
              communityId={communityId}
              currentDisplayMode={currentDisplayMode}
              onDone={refresh}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Users Section (mentor+) ───────────────────────────────────────────────────

function UsersSection({
  communityId,
  members,
  badges,
  onDone,
}: {
  communityId: string;
  members: Member[];
  badges: Badge[];
  onDone: () => void;
}) {
  const [targetUserId, setTargetUserId] = useState(members[0]?.user_id ?? "");
  const [xpAmount, setXpAmount] = useState("25");
  const [selectedBadgeId, setSelectedBadgeId] = useState(badges[0]?.id ?? "");
  const [creditsAmount, setCreditsAmount] = useState("100");
  const [xpLoading, setXpLoading] = useState(false);
  const [badgeLoading, setBadgeLoading] = useState(false);
  const [creditsLoading, setCreditsLoading] = useState(false);
  const [xpError, setXpError] = useState("");
  const [badgeError, setBadgeError] = useState("");
  const [creditsError, setCreditsError] = useState("");
  const [xpSuccess, setXpSuccess] = useState("");
  const [badgeSuccess, setBadgeSuccess] = useState("");
  const [creditsSuccess, setCreditsSuccess] = useState("");

  async function handleAwardXp(e: React.FormEvent) {
    e.preventDefault();
    setXpError("");
    setXpSuccess("");
    setXpLoading(true);
    const amount = Number(xpAmount);
    const res = await grantManualXp(communityId, targetUserId, amount);
    if ("error" in res) setXpError((res as { error: string }).error);
    else {
      setXpSuccess(`Queued +${Math.floor(amount)} XP`);
      onDone();
    }
    setXpLoading(false);
  }

  async function handleAwardBadge(e: React.FormEvent) {
    e.preventDefault();
    setBadgeError("");
    setBadgeSuccess("");
    setBadgeLoading(true);
    const res = await awardUserBadge(communityId, selectedBadgeId, targetUserId);
    if ("error" in res) setBadgeError((res as { error: string }).error);
    else {
      setBadgeSuccess("Badge awarded (+25 pending XP)");
      onDone();
    }
    setBadgeLoading(false);
  }

  async function handleAwardCredits(e: React.FormEvent) {
    e.preventDefault();
    setCreditsError("");
    setCreditsSuccess("");
    setCreditsLoading(true);
    const amount = Number(creditsAmount);
    const res = await awardCurrency(communityId, targetUserId, amount, "manual");
    if ("error" in res) setCreditsError((res as { error: string }).error);
    else {
      setCreditsSuccess(`+${amount} credits awarded`);
      onDone();
    }
    setCreditsLoading(false);
  }

  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-sm font-semibold text-white">Users</h2>
        <p className="mt-0.5 text-xs text-gray-600">
          Fast debug actions for mentor+ · queue manual XP and award badges directly
        </p>
      </div>

      <div className="card p-5 space-y-4">
        <div>
          <label className="label">Target user</label>
          <select
            value={targetUserId}
            onChange={(e) => setTargetUserId(e.target.value)}
            className="input"
          >
            {members.map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {displayName(members, m.user_id)} ({m.role})
              </option>
            ))}
          </select>
        </div>

        <form onSubmit={handleAwardXp} className="space-y-2">
          <label className="label">Award XP</label>
          <div className="flex flex-wrap gap-2">
            <input
              type="number"
              min={1}
              value={xpAmount}
              onChange={(e) => setXpAmount(e.target.value)}
              className="input w-32"
            />
            <button type="submit" disabled={xpLoading} className="btn-primary btn-sm">
              {xpLoading ? "Queueing…" : "Queue XP"}
            </button>
            {[25, 50, 100, 250].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setXpAmount(String(v))}
                className="btn-ghost btn-sm"
              >
                +{v}
              </button>
            ))}
          </div>
          {xpError && <p className="text-sm text-red-400">{xpError}</p>}
          {xpSuccess && <p className="text-sm text-emerald-400">{xpSuccess}</p>}
        </form>

        <form onSubmit={handleAwardBadge} className="space-y-2">
          <label className="label">Award Badge (medal)</label>
          {badges.length === 0 ? (
            <p className="text-sm text-gray-600">Create at least one badge first in the Badges tab.</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                <select
                  value={selectedBadgeId}
                  onChange={(e) => setSelectedBadgeId(e.target.value)}
                  className="input min-w-[240px]"
                >
                  {badges.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
                <button type="submit" disabled={badgeLoading} className="btn-primary btn-sm">
                  {badgeLoading ? "Awarding…" : "Award Badge"}
                </button>
              </div>
              {badgeError && <p className="text-sm text-red-400">{badgeError}</p>}
              {badgeSuccess && <p className="text-sm text-emerald-400">{badgeSuccess}</p>}
            </>
          )}
        </form>

        <form onSubmit={handleAwardCredits} className="space-y-2">
          <label className="label">Award Credits ◼</label>
          <div className="flex flex-wrap gap-2">
            <input
              type="number"
              min={1}
              value={creditsAmount}
              onChange={(e) => setCreditsAmount(e.target.value)}
              className="input w-32"
            />
            <button type="submit" disabled={creditsLoading} className="btn-primary btn-sm">
              {creditsLoading ? "Awarding…" : "Award Credits"}
            </button>
            {[50, 100, 250, 500].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setCreditsAmount(String(v))}
                className="btn-ghost btn-sm"
              >
                +{v}
              </button>
            ))}
          </div>
          {creditsError && <p className="text-sm text-red-400">{creditsError}</p>}
          {creditsSuccess && <p className="text-sm text-sky-400">{creditsSuccess}</p>}
        </form>
      </div>
    </section>
  );
}

// ── Trophies Section (admin/owner) ────────────────────────────────────────────

function TrophiesSection({
  communityId,
  trophies,
  members,
  onDone,
}: {
  communityId: string;
  trophies: TrophyWithAwards[];
  members: Member[];
  onDone: () => void;
}) {
  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-sm font-semibold text-white">Trophies</h2>
        <p className="mt-0.5 text-xs text-gray-600">
          Create custom trophies and award them to members. Trophy XP goes directly to career level.
        </p>
      </div>
      <CreateTrophyForm communityId={communityId} onDone={onDone} />
      {trophies.length > 0 && (
        <div className="space-y-3">
          {trophies.map((t) => (
            <TrophyAdminCard key={t.id} trophy={t} members={members} onDone={onDone} />
          ))}
        </div>
      )}
    </section>
  );
}

function CreateTrophyForm({ communityId, onDone }: { communityId: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [xpAward, setXpAward] = useState("100");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await createTrophy(communityId, {
      name,
      description: description || undefined,
      xp_award: parseInt(xpAward) || 100,
    });
    if ("error" in res) setError((res as { error: string }).error);
    else {
      setName("");
      setDescription("");
      setXpAward("100");
      setOpen(false);
      onDone();
    }
    setLoading(false);
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-primary btn-sm">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        New Trophy
      </button>
    );
  }

  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm font-semibold text-white">New Trophy</p>
        <button onClick={() => setOpen(false)} className="text-gray-600 hover:text-gray-400 transition-colors">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Trophy name</label>
            <input
              type="text"
              placeholder="e.g. Season Champion"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label className="label">Career XP award</label>
            <input
              type="number"
              min={1}
              value={xpAward}
              onChange={(e) => setXpAward(e.target.value)}
              className="input"
            />
          </div>
        </div>
        <div>
          <label className="label">Description <span className="text-gray-700">(optional)</span></label>
          <input
            type="text"
            placeholder="What is this trophy for?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="input"
          />
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <div className="flex gap-2">
          <button type="submit" disabled={loading} className="btn-primary btn-sm">
            {loading ? "Creating…" : "Create Trophy"}
          </button>
          <button type="button" onClick={() => setOpen(false)} className="btn-ghost btn-sm">Cancel</button>
        </div>
      </form>
    </div>
  );
}

function TrophyAdminCard({
  trophy,
  members,
  onDone,
}: {
  trophy: TrophyWithAwards;
  members: Member[];
  onDone: () => void;
}) {
  const [showAwardForm, setShowAwardForm] = useState(false);
  const [recipientId, setRecipientId] = useState(members[0]?.user_id ?? "");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleAward(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    const res = await awardTrophy(trophy.id, recipientId, notes || undefined);
    if ("error" in res) setError((res as { error: string }).error);
    else {
      setSuccess(`Trophy awarded (+${trophy.xp_award} Career XP)`);
      setNotes("");
      setShowAwardForm(false);
      onDone();
    }
    setLoading(false);
  }

  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#0f0f1a] px-5 py-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white">{trophy.name}</p>
          {trophy.description && (
            <p className="text-xs text-gray-600 truncate">{trophy.description}</p>
          )}
          <p className="text-[10px] text-amber-500 mt-0.5">+{trophy.xp_award} Career XP · {trophy.awards.length} awarded</p>
        </div>
        <button
          onClick={() => setShowAwardForm((v) => !v)}
          className="btn-ghost btn-sm text-xs shrink-0"
        >
          Award
        </button>
      </div>

      {showAwardForm && (
        <form onSubmit={handleAward} className="space-y-2 border-t border-white/[0.05] pt-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label text-xs">Member</label>
              <select
                value={recipientId}
                onChange={(e) => setRecipientId(e.target.value)}
                className="input py-1.5 text-sm"
              >
                {members.map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.profiles?.display_name || m.user_id.slice(0, 8) + "…"} ({m.role})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label text-xs">Note <span className="text-gray-700">(optional)</span></label>
              <input
                type="text"
                placeholder="e.g. 1st place"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="input py-1.5 text-sm"
              />
            </div>
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          {success && <p className="text-sm text-emerald-400">{success}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={loading} className="btn-primary btn-sm text-xs">
              {loading ? "Awarding…" : "Confirm Award"}
            </button>
            <button type="button" onClick={() => setShowAwardForm(false)} className="btn-ghost btn-sm text-xs">
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

// ── PermissionGate ─────────────────────────────────────────────────────────────

function PermissionGate({
  communityId,
  permission,
  hasPermission,
  hasPending,
  children,
}: {
  communityId: string;
  permission: GrantablePermission;
  hasPermission: boolean;
  hasPending: boolean;
  children: React.ReactNode;
}) {
  const [isPending, startTransition] = useTransition();
  const [requested, setRequested] = useState(hasPending);
  const [error, setError] = useState("");

  if (hasPermission) return <>{children}</>;

  function handleRequest() {
    setError("");
    startTransition(async () => {
      const res = await requestPermission(communityId, permission);
      if ("error" in res) setError((res as { error: string }).error);
      else setRequested(true);
    });
  }

  return (
    <div className="rounded-xl border border-white/[0.07] bg-[#0f0f1a] flex flex-col items-center gap-4 py-14 text-center px-8">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/[0.05] text-2xl">
        <Lock className="h-6 w-6 text-gray-500" />
      </div>
      <div>
        <p className="font-semibold text-white">{PERM_LABEL[permission]}</p>
        <p className="mt-1 text-sm text-gray-600">
          You need the{" "}
          <span className="font-mono text-xs text-violet-400">{permission}</span>{" "}
          permission to access this section.
        </p>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      {requested ? (
        <span className="rounded-full bg-amber-500/15 px-4 py-1.5 text-sm font-medium text-amber-400 ring-1 ring-amber-500/30">
          Request pending review…
        </span>
      ) : (
        <button onClick={handleRequest} disabled={isPending} className="btn-primary btn-sm">
          {isPending ? "Requesting…" : "Request Permission"}
        </button>
      )}
    </div>
  );
}

// ── Seasons Section ────────────────────────────────────────────────────────────

function SeasonsSection({
  communityId,
  seasons,
  onDone,
}: {
  communityId: string;
  seasons: Season[];
  onDone: () => void;
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">Seasons</h2>
      </div>
      <CreateSeasonForm communityId={communityId} onDone={onDone} />
      {seasons.length === 0 ? (
        <p className="text-sm text-gray-600">No seasons yet. Create one above.</p>
      ) : (
        <div className="space-y-4">
          {seasons.map((s) => (
            <SeasonCard key={s.id} season={s} communityId={communityId} onDone={onDone} />
          ))}
        </div>
      )}
    </section>
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
    const res = await createSeason(communityId, {
      name,
      starts_at: new Date(startsAt).toISOString(),
      ends_at: new Date(endsAt).toISOString(),
    });
    if ("error" in res) setError((res as { error: string }).error);
    else {
      setName("");
      setStartsAt("");
      setEndsAt("");
      setOpen(false);
      onDone();
    }
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
          <input
            type="text"
            placeholder="e.g. Spring 2026"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input"
          />
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
          <button type="submit" disabled={loading} className="btn-primary btn-sm">
            {loading ? "Creating…" : "Create Season"}
          </button>
          <button type="button" onClick={() => setOpen(false)} className="btn-ghost btn-sm">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

function SeasonCard({
  season,
  communityId,
  onDone,
}: {
  season: Season;
  communityId: string;
  onDone: () => void;
}) {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Edit season details
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(season.name);
  const [editStart, setEditStart] = useState(season.starts_at.slice(0, 10));
  const [editEnd, setEditEnd] = useState(season.ends_at.slice(0, 10));

  // Configure levels
  const [showLevelForm, setShowLevelForm] = useState(false);
  const [maxLevel, setMaxLevel] = useState("");
  const [xpPerLevel, setXpPerLevel] = useState("");

  const sortedTiers = [...season.battle_pass_tiers].sort((a, b) => a.tier_number - b.tier_number);
  const currentMax = sortedTiers.length > 0 ? sortedTiers[sortedTiers.length - 1].tier_number : 0;
  const existingXpPerLevel = sortedTiers.length > 0
    ? Math.round(sortedTiers[0].xp_required / sortedTiers[0].tier_number)
    : null;

  async function handleActivate() {
    setLoading(true);
    const res = await setActiveSeason(communityId, season.id);
    if ("error" in res) setError((res as { error: string }).error);
    else onDone();
    setLoading(false);
  }

  async function handleEditSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await updateSeason(communityId, season.id, {
      name: editName,
      starts_at: new Date(editStart).toISOString(),
      ends_at: new Date(editEnd).toISOString(),
    });
    if ("error" in res) setError((res as { error: string }).error);
    else { setEditing(false); onDone(); }
    setLoading(false);
  }

  async function handleConfigureLevels(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const effectiveXpPerLevel = existingXpPerLevel !== null ? existingXpPerLevel : parseInt(xpPerLevel);
    const res = await configureSeasonLevels(
      communityId,
      season.id,
      parseInt(maxLevel),
      effectiveXpPerLevel
    );
    if ("error" in res) setError((res as { error: string }).error);
    else { setMaxLevel(""); setXpPerLevel(""); setShowLevelForm(false); onDone(); }
    setLoading(false);
  }

  return (
    <div className="card p-5">
      {/* Header row */}
      <div className="mb-3 flex items-start justify-between gap-2">
        {editing ? (
          <form onSubmit={handleEditSave} className="flex-1 space-y-2">
            <input
              type="text"
              required
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="input py-1.5 text-sm"
              placeholder="Season name"
            />
            <div className="grid grid-cols-2 gap-2">
              <input type="date" required value={editStart} onChange={(e) => setEditStart(e.target.value)} className="input py-1.5 text-sm" />
              <input type="date" required value={editEnd} onChange={(e) => setEditEnd(e.target.value)} className="input py-1.5 text-sm" />
            </div>
            {error && <p className="text-xs text-red-400">{error}</p>}
            <div className="flex gap-2">
              <button type="submit" disabled={loading} className="btn-primary btn-sm text-xs">{loading ? "…" : "Save"}</button>
              <button type="button" onClick={() => { setEditing(false); setError(""); }} className="btn-ghost btn-sm text-xs">Cancel</button>
            </div>
          </form>
        ) : (
          <div className="min-w-0 flex-1">
            <p className="font-medium text-white">{season.name}</p>
            <p className="text-xs text-gray-600">
              {season.starts_at.slice(0, 10)} – {season.ends_at.slice(0, 10)}
            </p>
          </div>
        )}
        {!editing && (
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={() => { setEditing(true); setError(""); }}
              className="btn-ghost btn-sm text-xs"
            >
              Edit
            </button>
            {season.is_active ? (
              <span className="badge bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/20">Active</span>
            ) : (
              <button onClick={handleActivate} disabled={loading} className="btn-ghost btn-sm text-xs">
                Set Active
              </button>
            )}
          </div>
        )}
      </div>

      {/* Levels list */}
      {sortedTiers.length > 0 ? (
        <div className="mb-3 space-y-1">
          <div className="mb-1.5 flex items-center justify-between">
            <p className="text-xs font-medium text-gray-500">
              {currentMax} level{currentMax !== 1 ? "s" : ""} · {existingXpPerLevel} XP each
            </p>
            <p className="text-xs text-gray-700">
              +{Math.floor((existingXpPerLevel ?? 0) * 1.5)} pts per level
            </p>
          </div>
          {sortedTiers.map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-1.5 text-sm"
            >
              <span className="text-gray-400">Level {t.tier_number}</span>
              <span className="text-xs text-gray-600">{t.xp_required} XP total</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="mb-3 text-xs text-gray-700">No levels configured yet.</p>
      )}

      {/* Configure levels */}
      {showLevelForm ? (
        <form onSubmit={handleConfigureLevels} className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label text-xs">Max levels</label>
              <input
                type="number"
                placeholder={currentMax > 0 ? `> ${currentMax}` : "e.g. 10"}
                required
                min={currentMax + 1}
                value={maxLevel}
                onChange={(e) => setMaxLevel(e.target.value)}
                className="input py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="label text-xs">XP per level</label>
              <input
                type="number"
                placeholder="e.g. 100"
                required
                min={1}
                value={existingXpPerLevel !== null ? existingXpPerLevel.toString() : xpPerLevel}
                onChange={(e) => { if (existingXpPerLevel === null) setXpPerLevel(e.target.value); }}
                readOnly={existingXpPerLevel !== null}
                className={`input py-1.5 text-sm ${existingXpPerLevel !== null ? "opacity-50 cursor-not-allowed" : ""}`}
              />
              {existingXpPerLevel !== null && (
                <p className="mt-1 text-xs text-gray-700">Locked after first configuration</p>
              )}
            </div>
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={loading} className="btn-primary btn-sm text-xs">
              {loading ? "…" : "Save Levels"}
            </button>
            <button type="button" onClick={() => { setShowLevelForm(false); setError(""); }} className="btn-ghost btn-sm text-xs">
              Cancel
            </button>
          </div>
        </form>
      ) : (
        !editing && (
          <button onClick={() => setShowLevelForm(true)} className="btn-ghost btn-sm text-xs">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {currentMax > 0 ? "Add More Levels" : "Configure Levels"}
          </button>
        )
      )}
    </div>
  );
}

// ── Invites Section ────────────────────────────────────────────────────────────

function InvitesSection({
  communityId,
  slug,
  inviteCodes,
  onDone,
}: {
  communityId: string;
  slug: string;
  inviteCodes: InviteCode[];
  onDone: () => void;
}) {
  const [label, setLabel] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError("");
    const res = await createInviteCode(communityId, label || undefined);
    if ("error" in res) setError((res as { error: string }).error);
    else { setLabel(""); onDone(); }
    setCreating(false);
  }

  async function handleDeactivate(id: string) {
    startTransition(async () => {
      await deactivateInviteCode(communityId, id);
      onDone();
    });
  }

  function handleCopy(code: InviteCode) {
    const url = `${baseUrl}/join/${code.code}?ngrok-skip-browser-warning=1`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(code.id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }

  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-sm font-semibold text-white">Invite Links</h2>
        <p className="mt-0.5 text-xs text-gray-600">
          Share a link to let anyone join as a member. Deactivate codes at any time.
        </p>
      </div>

      {/* Create form */}
      <form onSubmit={handleCreate} className="flex items-end gap-2">
        <div className="flex-1">
          <label className="label">Label (optional)</label>
          <input
            type="text"
            placeholder="e.g. Discord post, Flyer"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="input"
          />
        </div>
        <button type="submit" disabled={creating} className="btn-primary btn-sm shrink-0">
          {creating ? "Creating…" : "Generate Link"}
        </button>
      </form>
      {error && <p className="text-xs text-red-400">{error}</p>}

      {/* Code list */}
      {inviteCodes.length === 0 ? (
        <p className="text-sm text-gray-600">No invite links yet.</p>
      ) : (
        <div className="space-y-2">
          {inviteCodes.map((inv) => (
            <div
              key={inv.id}
              className={`card flex items-center gap-3 px-4 py-3 ${!inv.is_active ? "opacity-50" : ""}`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <code className="font-mono text-sm font-semibold text-white tracking-widest">
                    {inv.code}
                  </code>
                  {inv.label && (
                    <span className="truncate text-xs text-gray-600">— {inv.label}</span>
                  )}
                  {!inv.is_active && (
                    <span className="text-xs text-gray-700">Inactive</span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-gray-700">
                  {inv.use_count} use{inv.use_count !== 1 ? "s" : ""}
                  {" · "}
                  {new Date(inv.created_at).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" })}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {inv.is_active && (
                  <>
                    <button
                      onClick={() => handleCopy(inv)}
                      className="btn-ghost btn-sm text-xs"
                    >
                      {copiedId === inv.id ? "Copied!" : "Copy Link"}
                    </button>
                    <button
                      onClick={() => handleDeactivate(inv.id)}
                      className="btn-ghost btn-sm text-xs text-red-400 hover:border-red-500/30 hover:bg-red-500/10"
                    >
                      Deactivate
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ── Badges Section ─────────────────────────────────────────────────────────────

function BadgesSection({
  communityId,
  badges,
  onDone,
}: {
  communityId: string;
  badges: Badge[];
  onDone: () => void;
}) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-white">Badges</h2>
        <p className="mt-0.5 text-xs text-gray-600">Create badges that mentors can award (+25 XP each)</p>
      </div>
      <CreateBadgeForm communityId={communityId} onDone={onDone} />
      {badges.length > 0 && (
        <div className="space-y-2">
          {badges.map((b) => (
            <div
              key={b.id}
              className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-[#0f0f1a] px-4 py-3"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/15 text-base">
                <Medal className="h-4 w-4 text-violet-300" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white">{b.name}</p>
                {b.description && <p className="text-xs text-gray-600 truncate">{b.description}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
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
    if ("error" in res) setError((res as { error: string }).error);
    else {
      setName("");
      setDescription("");
      setSuccess(true);
      onDone();
    }
    setLoading(false);
  }

  return (
    <div className="card p-5">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Badge name</label>
            <input
              type="text"
              placeholder="e.g. Top Contributor"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label className="label">
              Description <span className="text-gray-700">(optional)</span>
            </label>
            <input
              type="text"
              placeholder="What earns this badge?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input"
            />
          </div>
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        {success && <p className="text-sm text-emerald-400">Badge created!</p>}
        <button type="submit" disabled={loading} className="btn-primary btn-sm">
          {loading ? "Creating…" : "Create Badge"}
        </button>
      </form>
    </div>
  );
}

// ── Members Section ────────────────────────────────────────────────────────────

function MembersSection({
  communityId,
  members,
  currentRole,
  onDone,
}: {
  communityId: string;
  members: Member[];
  currentRole: CommunityRole;
  onDone: () => void;
}) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-white">Members</h2>
        <p className="mt-0.5 text-xs text-gray-600">
          {members.length} member{members.length !== 1 ? "s" : ""} · Toggle roles between member and mentor
        </p>
      </div>
      <div className="space-y-2">
        {members.map((m) => (
          <MemberRow
            key={m.id}
            member={m}
            communityId={communityId}
            currentRole={currentRole}
            onDone={onDone}
          />
        ))}
      </div>
    </section>
  );
}

function MemberRow({
  member,
  communityId,
  onDone,
}: {
  member: Member;
  communityId: string;
  currentRole: CommunityRole;
  onDone: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isElevated = member.role === "admin" || member.role === "owner";
  const name =
    member.profiles?.display_name?.trim() || member.user_id.slice(0, 8) + "…";

  async function handleRoleToggle(newRole: "member" | "mentor") {
    setLoading(true);
    setError("");
    const res = await changeMemberRole(communityId, member.user_id, newRole);
    if ("error" in res) setError((res as { error: string }).error);
    else onDone();
    setLoading(false);
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-[#0f0f1a] px-4 py-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-600/20 text-indigo-300 text-sm font-bold">
        {name.charAt(0).toUpperCase()}
      </div>
      <p className="flex-1 min-w-0 text-sm font-medium text-white truncate">{name}</p>
      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${ROLE_COLORS[member.role]}`}>
        {member.role}
      </span>
      {!isElevated && (
        <div className="flex gap-1.5">
          {member.role === "member" ? (
            <button
              onClick={() => handleRoleToggle("mentor")}
              disabled={loading}
              className="rounded-lg bg-blue-500/10 px-2.5 py-1 text-xs font-medium text-blue-400 transition-colors hover:bg-blue-500/20 disabled:opacity-50"
            >
              → Mentor
            </button>
          ) : (
            <button
              onClick={() => handleRoleToggle("member")}
              disabled={loading}
              className="btn-ghost btn-sm text-xs"
            >
              → Member
            </button>
          )}
        </div>
      )}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

// ── Controls Section (admin+) ──────────────────────────────────────────────────

function ControlsSection({
  communityId,
  permissionRequests,
  grants,
  members,
  isOwner,
  onDone,
}: {
  communityId: string;
  permissionRequests: PermReq[];
  grants: Grant[];
  members: Member[];
  isOwner: boolean;
  onDone: () => void;
}) {
  const mentors = members.filter((m) => m.role === "mentor");
  const admins = members.filter((m) => m.role === "admin");

  return (
    <div className="space-y-8">
      {/* Permission Requests */}
      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-white">Permission Requests</h2>
          <p className="mt-0.5 text-xs text-gray-600">Approve or deny mentor permission requests</p>
        </div>
        {permissionRequests.length === 0 ? (
          <div className="rounded-xl border border-white/[0.06] bg-[#0f0f1a] px-5 py-6 text-center">
            <p className="text-sm text-gray-600">No pending requests.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {permissionRequests.map((req) => (
              <PermissionRequestRow
                key={req.id}
                req={req}
                members={members}
                onDone={onDone}
              />
            ))}
          </div>
        )}
      </section>

      {/* Active Grants */}
      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-white">Active Grants</h2>
          <p className="mt-0.5 text-xs text-gray-600">Explicit permissions granted to mentors</p>
        </div>
        {grants.length === 0 ? (
          <div className="rounded-xl border border-white/[0.06] bg-[#0f0f1a] px-5 py-6 text-center">
            <p className="text-sm text-gray-600">No explicit grants. Admins inherit all permissions by role.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {grants.map((grant) => (
              <GrantRow
                key={grant.id}
                grant={grant}
                communityId={communityId}
                members={members}
                onDone={onDone}
              />
            ))}
          </div>
        )}
      </section>

      {/* Admin Management (owner only) */}
      {isOwner && (
        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-white">Admin Management</h2>
            <p className="mt-0.5 text-xs text-gray-600">Promote mentors to admin or demote admins</p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Promote mentors */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Promote to Admin</p>
              {mentors.length === 0 ? (
                <p className="text-xs text-gray-700">No mentors to promote.</p>
              ) : (
                mentors.map((m) => (
                  <AdminActionRow
                    key={m.id}
                    member={m}
                    communityId={communityId}
                    action="promote"
                    onDone={onDone}
                  />
                ))
              )}
            </div>
            {/* Demote admins */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Demote to Mentor</p>
              {admins.length === 0 ? (
                <p className="text-xs text-gray-700">No admins to demote.</p>
              ) : (
                admins.map((m) => (
                  <AdminActionRow
                    key={m.id}
                    member={m}
                    communityId={communityId}
                    action="demote"
                    onDone={onDone}
                  />
                ))
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function PermissionRequestRow({
  req,
  members,
  onDone,
}: {
  req: PermReq;
  members: Member[];
  onDone: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleReview(action: "approve" | "deny") {
    setLoading(true);
    const res = await reviewPermissionRequest(req.id, action);
    if (!("error" in res)) {
      setDone(true);
      onDone();
    }
    setLoading(false);
  }

  if (done) return null;

  const name = displayName(members, req.requester_id);
  const permLabel = PERM_LABEL[req.permission as GrantablePermission] ?? req.permission;

  return (
    <div className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-[#0f0f1a] px-4 py-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-600/20 text-violet-300 text-sm font-bold">
        {name.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white">{name}</p>
        <p className="text-xs text-gray-500">requesting · {permLabel}</p>
        {req.requester_note && (
          <p className="mt-1 text-xs text-gray-600 italic">"{req.requester_note}"</p>
        )}
      </div>
      <div className="flex gap-2 shrink-0">
        <button
          onClick={() => handleReview("approve")}
          disabled={loading}
          className="rounded-lg bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-400 transition-colors hover:bg-emerald-500/25 disabled:opacity-50"
        >
          Approve
        </button>
        <button
          onClick={() => handleReview("deny")}
          disabled={loading}
          className="btn-ghost btn-sm text-xs"
        >
          Deny
        </button>
      </div>
    </div>
  );
}

function GrantRow({
  grant,
  communityId,
  members,
  onDone,
}: {
  grant: Grant;
  communityId: string;
  members: Member[];
  onDone: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleRevoke() {
    setLoading(true);
    const res = await revokePermission(communityId, grant.user_id, grant.permission as GrantablePermission);
    if (!("error" in res)) {
      setDone(true);
      onDone();
    }
    setLoading(false);
  }

  if (done) return null;

  const name = displayName(members, grant.user_id);
  const permLabel = PERM_LABEL[grant.permission as GrantablePermission] ?? grant.permission;

  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-[#0f0f1a] px-4 py-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-600/20 text-indigo-300 text-sm font-bold">
        {name.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white">{name}</p>
        <p className="text-xs text-gray-600">{permLabel}</p>
      </div>
      <button
        onClick={handleRevoke}
        disabled={loading}
        className="rounded-lg px-2.5 py-1 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-50"
      >
        Revoke
      </button>
    </div>
  );
}

function AdminActionRow({
  member,
  communityId,
  action,
  onDone,
}: {
  member: Member;
  communityId: string;
  action: "promote" | "demote";
  onDone: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const name =
    member.profiles?.display_name?.trim() || member.user_id.slice(0, 8) + "…";

  async function handle() {
    setLoading(true);
    setError("");
    const res =
      action === "promote"
        ? await promoteToAdmin(communityId, member.user_id)
        : await demoteAdmin(communityId, member.user_id);
    if ("error" in res) setError((res as { error: string }).error);
    else onDone();
    setLoading(false);
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-[#0f0f1a] px-4 py-3">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-600/20 text-indigo-300 text-xs font-bold">
        {name.charAt(0).toUpperCase()}
      </div>
      <p className="flex-1 min-w-0 text-sm text-white truncate">{name}</p>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <button
        onClick={handle}
        disabled={loading}
        className={
          action === "promote"
            ? "rounded-lg bg-purple-500/15 px-2.5 py-1 text-xs font-medium text-purple-400 transition-colors hover:bg-purple-500/25 disabled:opacity-50"
            : "rounded-lg px-2.5 py-1 text-xs font-medium text-gray-500 transition-colors hover:bg-white/[0.05] disabled:opacity-50"
        }
      >
        {loading ? "…" : action === "promote" ? "→ Admin" : "→ Mentor"}
      </button>
    </div>
  );
}

// ── Theme Section (owner only) ─────────────────────────────────────────────────

const THEME_META: Record<ThemeKey, { label: string; bg: string; accent: string; accent2: string }> = {
  "ascnd":      { label: "ASCND Default", bg: "#06070b", accent: "#3be8ff", accent2: "#7dff74" },
  "sky-high":   { label: "Sky High",      bg: "#03060d", accent: "#38bdf8", accent2: "#7dd3fc" },
  "high-tide":  { label: "High Tide",     bg: "#02090c", accent: "#2dd4bf", accent2: "#34d399" },
  "ruby":       { label: "Ruby",          bg: "#0a0305", accent: "#f87171", accent2: "#fb923c" },
  "evergreen":  { label: "Evergreen",     bg: "#020a04", accent: "#4ade80", accent2: "#86efac" },
  "saffron":    { label: "Saffron",       bg: "#080601", accent: "#fbbf24", accent2: "#fcd34d" },
  "bloom":      { label: "Bloom",         bg: "#060408", accent: "#a78bfa", accent2: "#d946ef" },
  "tangerine":  { label: "Tangerine",     bg: "#080502", accent: "#fb923c", accent2: "#fdba74" },
};

function ThemeSection({
  communityId,
  currentTheme,
  onDone,
}: {
  communityId: string;
  currentTheme: string;
  onDone: () => void;
}) {
  const [selected, setSelected] = useState(currentTheme as ThemeKey);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  function handleSelect(key: ThemeKey) {
    setSelected(key);
    setSaved(false);
    setError("");
  }

  async function handleSave() {
    setError("");
    setSaved(false);
    startTransition(async () => {
      const res = await updateCommunityTheme(communityId, selected);
      if ("error" in res) {
        setError((res as { error: string }).error);
      } else {
        setSaved(true);
        onDone();
      }
    });
  }

  return (
    <section className="space-y-5 max-w-lg">
      <div>
        <h2 className="text-sm font-semibold text-white">Community Theme</h2>
        <p className="mt-1 text-xs text-gray-500">
          Choose a color palette for this community. Only visible to you until saved.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {THEME_KEYS.map((key) => {
          const meta = THEME_META[key];
          const isActive = selected === key;
          return (
            <button
              key={key}
              onClick={() => handleSelect(key)}
              style={{
                borderColor: isActive ? meta.accent : "rgba(255,255,255,0.08)",
                boxShadow: isActive
                  ? `0 0 0 1px ${meta.accent}55, 0 0 16px ${meta.accent}33`
                  : "none",
              }}
              className="card flex flex-col items-center gap-2 p-3 cursor-pointer transition-all duration-150 hover:border-white/20"
            >
              {/* Color preview */}
              <div
                className="h-10 w-full overflow-hidden"
                style={{ background: meta.bg, position: "relative" }}
              >
                {/* Accent stripe */}
                <div
                  style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: "4px",
                    background: `linear-gradient(90deg, ${meta.accent}, ${meta.accent2})`,
                    boxShadow: `0 0 8px ${meta.accent}aa`,
                  }}
                />
                {/* Accent dot */}
                <div
                  style={{
                    position: "absolute",
                    top: "8px",
                    left: "50%",
                    transform: "translateX(-50%)",
                    width: "12px",
                    height: "12px",
                    background: meta.accent,
                    boxShadow: `0 0 10px ${meta.accent}cc`,
                  }}
                />
              </div>
              <span
                className="text-[10px] font-semibold uppercase tracking-widest leading-tight text-center"
                style={{ color: isActive ? meta.accent : "rgba(148,163,184,0.8)" }}
              >
                {meta.label}
              </span>
              {isActive && (
                <span
                  className="text-[9px] font-bold uppercase tracking-widest"
                  style={{ color: meta.accent }}
                >
                  Selected
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={pending || selected === currentTheme}
          className="btn-primary btn-sm"
        >
          {pending ? "Saving…" : "Save Theme"}
        </button>
        {saved && (
          <span className="text-xs text-green-400">Theme saved! Reload to see it applied.</span>
        )}
        {error && <span className="text-xs text-red-400">{error}</span>}
      </div>
    </section>
  );
}

// ── Display Mode Section (owner only) ─────────────────────────────────────────

const DISPLAY_MODE_OPTIONS: { value: string; label: string; description: string }[] = [
  { value: "username",          label: "@Username",           description: "Show @handle (default)" },
  { value: "full_name",         label: "Full Name",           description: "Show first and last name" },
  { value: "first_last_initial",label: "First + Last Initial",description: "e.g. Jordan T." },
  { value: "custom",            label: "Custom Nickname",     description: "Show nickname / display name" },
];

function DisplayModeSection({
  communityId,
  currentDisplayMode,
  onDone,
}: {
  communityId: string;
  currentDisplayMode: string;
  onDone: () => void;
}) {
  const [selected, setSelected] = useState(currentDisplayMode);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  function handleSave() {
    setError("");
    setSaved(false);
    startTransition(async () => {
      const res = await updateNameDisplayMode(communityId, selected);
      if ("error" in res) {
        setError(res.error);
      } else {
        setSaved(true);
        onDone();
      }
    });
  }

  return (
    <section>
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-white">Name Display Mode</h3>
        <p className="mt-1 text-xs text-gray-600">
          Controls how member names appear on posts and the feed across this community.
        </p>
      </div>

      <div className="space-y-2">
        {DISPLAY_MODE_OPTIONS.map((opt) => {
          const isActive = selected === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => setSelected(opt.value)}
              className={[
                "w-full flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-all",
                isActive
                  ? "border-[rgba(59,232,255,0.4)] bg-[rgba(59,232,255,0.08)]"
                  : "border-white/[0.07] bg-white/[0.02] hover:border-white/20",
              ].join(" ")}
            >
              <div className={[
                "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2",
                isActive ? "border-[#3be8ff]" : "border-white/20",
              ].join(" ")}>
                {isActive && <div className="h-2 w-2 rounded-full bg-[#3be8ff]" />}
              </div>
              <div>
                <p className={["text-sm font-medium", isActive ? "text-white" : "text-gray-400"].join(" ")}>
                  {opt.label}
                </p>
                <p className="text-xs text-gray-600">{opt.description}</p>
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={pending || selected === currentDisplayMode}
          className="btn-primary btn-sm"
        >
          {pending ? "Saving…" : "Save Display Mode"}
        </button>
        {saved && <span className="text-xs text-green-400">Saved!</span>}
        {error && <span className="text-xs text-red-400">{error}</span>}
      </div>
    </section>
  );
}
