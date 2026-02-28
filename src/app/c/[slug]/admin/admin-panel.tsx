"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSeason, setActiveSeason, createBattlePassTier } from "@/actions/battlepass";
import { createBadge } from "@/actions/badges";
import {
  requestPermission,
  reviewPermissionRequest,
  revokePermission,
  changeMemberRole,
  promoteToAdmin,
  demoteAdmin,
} from "@/actions/management";
import type { CommunityRole, GrantablePermission } from "@/lib/rbac";

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
  manage_seasons: "Manage Seasons & Battle Pass",
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
  permissionRequests: PermReq[];
  grants: Grant[];
}

type TabId = "seasons" | "badges" | "members" | "controls";

export function ManagementPanel({
  communityId,
  role,
  grantedPermissions,
  myPendingRequests,
  seasons,
  badges,
  members,
  permissionRequests,
  grants,
}: Props) {
  const router = useRouter();
  const isAdmin = role === "owner" || role === "admin";
  const isOwner = role === "owner";
  const [activeTab, setActiveTab] = useState<TabId>("seasons");

  const tabs: { id: TabId; label: string }[] = [
    { id: "seasons", label: "Seasons" },
    { id: "badges", label: "Badges" },
    { id: "members", label: "Members" },
    ...(isAdmin ? [{ id: "controls" as TabId, label: "Controls" }] : []),
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
      </div>
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
        🔒
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
  const [tierNum, setTierNum] = useState("");
  const [xpReq, setXpReq] = useState("");
  const [reward, setReward] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showTierForm, setShowTierForm] = useState(false);

  async function handleActivate() {
    setLoading(true);
    const res = await setActiveSeason(communityId, season.id);
    if ("error" in res) setError((res as { error: string }).error);
    else onDone();
    setLoading(false);
  }

  async function handleAddTier(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await createBattlePassTier(communityId, season.id, {
      tier_number: parseInt(tierNum),
      xp_required: parseInt(xpReq),
      reward_label: reward,
    });
    if ("error" in res) setError((res as { error: string }).error);
    else {
      setTierNum("");
      setXpReq("");
      setReward("");
      setShowTierForm(false);
      onDone();
    }
    setLoading(false);
  }

  const sortedTiers = [...season.battle_pass_tiers].sort((a, b) => a.tier_number - b.tier_number);

  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="font-medium text-white">{season.name}</p>
          <p className="text-xs text-gray-600">
            {new Date(season.starts_at).toLocaleDateString()} – {new Date(season.ends_at).toLocaleDateString()}
          </p>
        </div>
        {season.is_active ? (
          <span className="badge bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/20">Active</span>
        ) : (
          <button onClick={handleActivate} disabled={loading} className="btn-ghost btn-sm text-xs">
            Set Active
          </button>
        )}
      </div>
      {sortedTiers.length > 0 && (
        <div className="mb-3 space-y-1">
          {sortedTiers.map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2 text-sm"
            >
              <span className="text-gray-400">
                Tier {t.tier_number}
                {t.reward_label ? ": " + t.reward_label : ""}
              </span>
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
              <input
                type="number"
                placeholder="1"
                required
                min={1}
                value={tierNum}
                onChange={(e) => setTierNum(e.target.value)}
                className="input py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="label text-xs">XP required</label>
              <input
                type="number"
                placeholder="100"
                required
                min={0}
                value={xpReq}
                onChange={(e) => setXpReq(e.target.value)}
                className="input py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="label text-xs">Reward</label>
              <input
                type="text"
                placeholder="Badge, Role…"
                value={reward}
                onChange={(e) => setReward(e.target.value)}
                className="input py-1.5 text-sm"
              />
            </div>
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={loading} className="btn-primary btn-sm text-xs">
              {loading ? "…" : "Add Tier"}
            </button>
            <button type="button" onClick={() => setShowTierForm(false)} className="btn-ghost btn-sm text-xs">
              Cancel
            </button>
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
                🏅
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
