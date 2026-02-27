import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { getCommunityBySlug, getMembership } from "@/lib/rbac";
import {
  getWeeklyLeaderboard,
  getSeasonLeaderboard,
  getMyRankWeekly,
  getMyRankSeason,
} from "@/actions/leaderboard";
import { LeaderboardTabs } from "./leaderboard-tabs";

export default async function LeaderboardPage({
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

  const [weekly, season, myWeekly, mySeason] = await Promise.all([
    getWeeklyLeaderboard(community.id),
    getSeasonLeaderboard(community.id),
    getMyRankWeekly(community.id, user.id),
    getMyRankSeason(community.id, user.id),
  ]);

  return (
    <LeaderboardTabs
      weekly={weekly}
      season={season}
      myWeekly={myWeekly}
      mySeason={mySeason}
      userId={user.id}
    />
  );
}
