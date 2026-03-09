import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { getCommunityBySlug, getMembership } from "@/lib/rbac";
import { getActiveSeason, listTiers, getUserSeasonXp, getUserCareerXp } from "@/actions/battlepass";
import { getPendingXp } from "@/actions/xp";
import { getCurrencyBalance } from "@/actions/currency";
import { XpClaimSection } from "./xp-claim";

export default async function BattlePassPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const community = await getCommunityBySlug(supabase, slug);
  const membership = await getMembership(supabase, community.id, user.id);
  if (!membership) redirect(`/c/${slug}`);

  const season = await getActiveSeason(community.id);

  if (!season) {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="border-b border-white/[0.06] px-8 py-5">
          <h1 className="text-lg font-semibold text-white">Seasonal Climb</h1>
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

  const [tiers, xpTotal, pendingItems, careerXp, currencyBalance] = await Promise.all([
    listTiers(season.id),
    getUserSeasonXp(community.id, user.id, season.id),
    getPendingXp(community.id),
    getUserCareerXp(community.id, user.id),
    getCurrencyBalance(community.id),
  ]);

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Page header */}
      <div className="border-b border-white/[0.06] px-8 py-5">
        <h1 className="text-lg font-semibold text-white">Seasonal Climb</h1>
        <p className="mt-0.5 text-sm text-gray-600">
          {season.name} ·{" "}
          {new Date(season.starts_at).toLocaleDateString("en", { month: "short", day: "numeric" })} –{" "}
          {new Date(season.ends_at).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" })}
        </p>
      </div>

      <div className="px-8 py-6">
        <XpClaimSection
          communityId={community.id}
          initialXp={xpTotal}
          initialCareerXp={careerXp}
          initialCurrency={currencyBalance}
          pendingItems={pendingItems}
          tiers={tiers}
          season={season}
        />
      </div>
    </div>
  );
}
