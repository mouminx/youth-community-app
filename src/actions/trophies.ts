"use server";

import { getSupabaseServerClient } from "@/lib/supabaseServer";

export type Trophy = {
  id: string;
  name: string;
  description: string | null;
  icon_url: string | null;
  xp_award: number;
  created_at: string;
};

export type TrophyAward = {
  id: string;
  trophy_id: string;
  user_id: string;
  awarded_by: string | null;
  awarded_at: string;
  notes: string | null;
  recipient_name: string;
};

export type TrophyWithAwards = Trophy & { awards: TrophyAward[] };

// ── List all trophies with their award recipients ──────────────────────────────
export async function listTrophiesWithAwards(communityId: string): Promise<TrophyWithAwards[]> {
  const supabase = await getSupabaseServerClient();

  const [trophiesRes, awardsRes] = await Promise.all([
    supabase
      .from("trophies")
      .select("id, name, description, icon_url, xp_award, created_at")
      .eq("community_id", communityId)
      .order("created_at", { ascending: false }),
    supabase
      .from("trophy_awards")
      .select("id, trophy_id, user_id, awarded_by, awarded_at, notes")
      .eq("community_id", communityId)
      .order("awarded_at", { ascending: false }),
  ]);

  const trophies = trophiesRes.data ?? [];
  const awards = awardsRes.data ?? [];

  if (trophies.length === 0) return [];

  // Fetch profiles for all recipients
  const userIds = [...new Set(awards.map((a) => a.user_id))];
  const profileMap = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name")
      .in("id", userIds);
    for (const p of profiles ?? []) {
      profileMap.set(p.id, p.display_name || p.id.slice(0, 8) + "…");
    }
  }

  // Group awards by trophy
  const awardsMap = new Map<string, TrophyAward[]>();
  for (const a of awards) {
    const mapped: TrophyAward = {
      id: a.id,
      trophy_id: a.trophy_id,
      user_id: a.user_id,
      awarded_by: a.awarded_by,
      awarded_at: a.awarded_at,
      notes: a.notes,
      recipient_name: profileMap.get(a.user_id) ?? a.user_id.slice(0, 8) + "…",
    };
    if (!awardsMap.has(a.trophy_id)) awardsMap.set(a.trophy_id, []);
    awardsMap.get(a.trophy_id)!.push(mapped);
  }

  return trophies.map((t) => ({ ...t, awards: awardsMap.get(t.id) ?? [] }));
}

// ── Create a trophy (admin/owner) ─────────────────────────────────────────────
export async function createTrophy(
  communityId: string,
  payload: { name: string; description?: string; xp_award: number }
) {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.rpc("create_trophy", {
    _community_id: communityId,
    _name: payload.name,
    _description: payload.description ?? null,
    _xp_award: payload.xp_award,
  });
  if (error) return { error: error.message };
  return { data };
}

// ── Award a trophy to a member (admin/owner) ──────────────────────────────────
export async function awardTrophy(
  trophyId: string,
  recipientId: string,
  notes?: string
) {
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.rpc("award_trophy", {
    _trophy_id: trophyId,
    _recipient_id: recipientId,
    _notes: notes ?? null,
  });
  if (error) return { error: error.message };
  return { data: { success: true } };
}
