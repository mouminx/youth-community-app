"use server";

import { getSupabaseServerClient } from "@/lib/supabaseServer";

export type PendingXpItem = {
  id: string;
  amount: number;
  reason: string;
  created_at: string;
};

// ── List unclaimed XP for the current user in a community ──────────────────────
export async function getPendingXp(communityId: string): Promise<PendingXpItem[]> {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("pending_xp")
    .select("id, amount, reason, created_at")
    .eq("community_id", communityId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  return (data ?? []) as PendingXpItem[];
}

// ── Claim all pending XP for the current user (calls security-definer RPC) ─────
export async function claimPendingXp(
  communityId: string
): Promise<{ claimed: number } | { error: string }> {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data, error } = await supabase.rpc("claim_pending_xp", {
    _community_id: communityId,
  });

  if (error) return { error: error.message };
  return { claimed: (data as { claimed: number }).claimed };
}
