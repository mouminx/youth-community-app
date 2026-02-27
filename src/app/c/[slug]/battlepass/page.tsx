import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { getCommunityBySlug, getMembership } from "@/lib/rbac";
import { getActiveSeason, listTiers, getUserSeasonXp } from "@/actions/battlepass";
import { computeUnlockedTiers, getNextTier } from "@/lib/gamification";

export default async function BattlePassPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const community = await getCommunityBySlug(supabase, slug);
  const membership = await getMembership(supabase, community.id, user.id);
  if (!membership) redirect(`/c/${slug}`);

  const season = await getActiveSeason(community.id);

  if (!season) {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="border-b border-white/[0.06] px-8 py-5">
          <h1 className="text-lg font-semibold text-white">Battle Pass</h1>
          <p className="mt-0.5 text-sm text-gray-600">Season rewards and progression</p>
        </div>
        <div className="px-8 py-6">
          <div className="card flex flex-col items-center gap-3 py-12 text-center">
            <svg className="h-8 w-8 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-gray-600">No active season right now. Check back later!</p>
          </div>
        </div>
      </div>
    );
  }

  const [tiers, xpTotal] = await Promise.all([
    listTiers(season.id),
    getUserSeasonXp(community.id, user.id, season.id),
  ]);

  const tiersWithStatus = computeUnlockedTiers(xpTotal, tiers);
  const nextTier = getNextTier(xpTotal, tiers);

  const progressPercent = nextTier
    ? Math.min(100, Math.round((xpTotal / nextTier.xp_required) * 100))
    : 100;

  const unlockedCount = tiersWithStatus.filter((t) => t.unlocked).length;

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Page header */}
      <div className="border-b border-white/[0.06] px-8 py-5">
        <h1 className="text-lg font-semibold text-white">Battle Pass</h1>
        <p className="mt-0.5 text-sm text-gray-600">
          {season.name} · {new Date(season.starts_at).toLocaleDateString("en", { month: "short", day: "numeric" })} – {new Date(season.ends_at).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" })}
        </p>
      </div>

      <div className="px-8 py-6 space-y-6">
        {/* XP Progress card */}
        <div className="card px-6 py-5">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-medium text-gray-600">Season XP</p>
            <p className="text-xs text-gray-600">
              {unlockedCount}/{tiersWithStatus.length} tiers unlocked
            </p>
          </div>
          <div className="flex items-baseline justify-between mt-1 mb-4">
            <span className="text-3xl font-bold text-white">{xpTotal} XP</span>
            {nextTier ? (
              <span className="text-sm text-gray-500">
                {nextTier.xp_required - xpTotal} XP to Tier {nextTier.tier_number}
              </span>
            ) : (
              <span className="text-sm font-medium text-emerald-400">All tiers unlocked!</span>
            )}
          </div>
          <div className="relative h-2.5 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-indigo-600 to-indigo-400 transition-all duration-700"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          {nextTier && (
            <p className="mt-2 text-right text-xs text-gray-700">{progressPercent}%</p>
          )}
        </div>

        {/* Tiers */}
        {tiersWithStatus.length === 0 ? (
          <div className="card flex flex-col items-center gap-3 py-10 text-center">
            <p className="text-sm text-gray-600">No tiers configured for this season yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {tiersWithStatus.map((tier) => (
              <div
                key={tier.id}
                className={`card flex items-center gap-4 px-5 py-4 transition-all ${
                  tier.unlocked
                    ? "border-emerald-500/20 bg-emerald-500/5"
                    : "opacity-60"
                }`}
              >
                {/* Tier icon */}
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                  tier.unlocked ? "bg-emerald-500/20" : "bg-white/[0.04]"
                }`}>
                  {tier.unlocked ? (
                    <svg className="h-5 w-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="h-4 w-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white">
                    Tier {tier.tier_number}
                    {tier.reward_label && (
                      <span className="ml-2 text-gray-500">· {tier.reward_label}</span>
                    )}
                  </p>
                  <p className="text-xs text-gray-600">{tier.xp_required} XP required</p>
                </div>

                {/* Status */}
                {tier.unlocked ? (
                  <span className="badge bg-emerald-500/15 text-emerald-300">Unlocked</span>
                ) : (
                  <span className="badge bg-white/[0.04] text-gray-600">Locked</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
