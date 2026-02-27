"use server";

import { getSupabaseServerClient } from "@/lib/supabaseServer";

type LeaderboardEntry = {
  user_id: string;
  display_name: string;
  avatar_url: string;
  xp_total: number;
  rank: number;
};

// ── Weekly leaderboard (last 7 days) ───────────────────────────
// Uses dense_rank: tied users share the same rank, no gaps.
export async function getWeeklyLeaderboard(
  communityId: string
): Promise<LeaderboardEntry[]> {
  const supabase = await getSupabaseServerClient();
  const sevenDaysAgo = new Date(
    Date.now() - 7 * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data } = await supabase.rpc("leaderboard_weekly", {
    _community_id: communityId,
    _since: sevenDaysAgo,
    _limit: 10,
  });

  return (data as LeaderboardEntry[]) ?? [];
}

// ── Season leaderboard ─────────────────────────────────────────
export async function getSeasonLeaderboard(
  communityId: string
): Promise<LeaderboardEntry[]> {
  const supabase = await getSupabaseServerClient();

  // Find active season.
  const { data: season } = await supabase
    .from("seasons")
    .select("id")
    .eq("community_id", communityId)
    .eq("is_active", true)
    .single();

  if (!season) return [];

  const { data } = await supabase.rpc("leaderboard_season", {
    _community_id: communityId,
    _season_id: season.id,
    _limit: 10,
  });

  return (data as LeaderboardEntry[]) ?? [];
}

// ── My rank (weekly) ───────────────────────────────────────────
export async function getMyRankWeekly(
  communityId: string,
  userId: string
): Promise<LeaderboardEntry | null> {
  const supabase = await getSupabaseServerClient();
  const sevenDaysAgo = new Date(
    Date.now() - 7 * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data } = await supabase.rpc("my_rank_weekly", {
    _community_id: communityId,
    _user_id: userId,
    _since: sevenDaysAgo,
  });

  return (data as LeaderboardEntry[] | null)?.[0] ?? null;
}

// ── My rank (season) ───────────────────────────────────────────
export async function getMyRankSeason(
  communityId: string,
  userId: string
): Promise<LeaderboardEntry | null> {
  const supabase = await getSupabaseServerClient();

  const { data: season } = await supabase
    .from("seasons")
    .select("id")
    .eq("community_id", communityId)
    .eq("is_active", true)
    .single();

  if (!season) return null;

  const { data } = await supabase.rpc("my_rank_season", {
    _community_id: communityId,
    _user_id: userId,
    _season_id: season.id,
  });

  return (data as LeaderboardEntry[] | null)?.[0] ?? null;
}
