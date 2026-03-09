"use server";

import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { requirePermission } from "@/lib/rbac";

// ── Get active season for a community ──────────────────────────
export async function getActiveSeason(communityId: string) {
  const supabase = await getSupabaseServerClient();
  const { data } = await supabase
    .from("seasons")
    .select("*")
    .eq("community_id", communityId)
    .eq("is_active", true)
    .single();
  return data;
}

// ── List tiers for a season ────────────────────────────────────
export async function listTiers(seasonId: string) {
  const supabase = await getSupabaseServerClient();
  const { data } = await supabase
    .from("battle_pass_tiers")
    .select("*")
    .eq("season_id", seasonId)
    .order("tier_number", { ascending: true });
  return data ?? [];
}

// ── User's all-time XP total (all seasons) ────────────────────
export async function getUserCareerXp(communityId: string, userId: string) {
  const supabase = await getSupabaseServerClient();
  const { data } = await supabase
    .from("xp_transactions")
    .select("amount")
    .eq("community_id", communityId)
    .eq("user_id", userId);
  return (data ?? []).reduce((sum, row) => sum + row.amount, 0);
}

// ── User's season XP total ─────────────────────────────────────
export async function getUserSeasonXp(
  communityId: string,
  userId: string,
  seasonId: string
) {
  const supabase = await getSupabaseServerClient();
  const { data } = await supabase
    .from("xp_transactions")
    .select("amount")
    .eq("community_id", communityId)
    .eq("user_id", userId)
    .eq("season_id", seasonId);

  const total = (data ?? []).reduce((sum, row) => sum + row.amount, 0);
  return total;
}

// ── Create season (admin+) ─────────────────────────────────────
export async function createSeason(
  communityId: string,
  payload: { name: string; starts_at: string; ends_at: string }
) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  try {
    await requirePermission(supabase, communityId, user.id, "manage_seasons");
  } catch {
    return { error: "Requires manage_seasons permission" };
  }

  const { data, error } = await supabase
    .from("seasons")
    .insert({
      community_id: communityId,
      name: payload.name,
      starts_at: payload.starts_at,
      ends_at: payload.ends_at,
      is_active: false,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  return { data };
}

// ── Set active season (admin+) ─────────────────────────────────
// Deactivates all others first, then activates the target.
export async function setActiveSeason(communityId: string, seasonId: string) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  try {
    await requirePermission(supabase, communityId, user.id, "manage_seasons");
  } catch {
    return { error: "Requires manage_seasons permission" };
  }

  // Deactivate all seasons in this community.
  await supabase
    .from("seasons")
    .update({ is_active: false })
    .eq("community_id", communityId)
    .eq("is_active", true);

  // Activate the target season.
  const { error } = await supabase
    .from("seasons")
    .update({ is_active: true })
    .eq("id", seasonId)
    .eq("community_id", communityId);

  if (error) return { error: error.message };
  return { data: { success: true } };
}

// ── Update season name/dates (manage_seasons) ──────────────────
export async function updateSeason(
  communityId: string,
  seasonId: string,
  payload: { name: string; starts_at: string; ends_at: string }
) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  try {
    await requirePermission(supabase, communityId, user.id, "manage_seasons");
  } catch {
    return { error: "Requires manage_seasons permission" };
  }

  const { error } = await supabase
    .from("seasons")
    .update({
      name: payload.name,
      starts_at: payload.starts_at,
      ends_at: payload.ends_at,
    })
    .eq("id", seasonId)
    .eq("community_id", communityId);

  if (error) return { error: error.message };
  return { data: { success: true } };
}

// ── Configure season levels (manage_seasons) ───────────────────
// Append-only: creates levels from (current_count + 1) to maxLevel.
// All levels have uniform xp_required = tier_number * xpPerLevel.
// xpPerLevel cannot be changed once any tiers exist.
export async function configureSeasonLevels(
  communityId: string,
  seasonId: string,
  maxLevel: number,
  xpPerLevel: number
) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  try {
    await requirePermission(supabase, communityId, user.id, "manage_seasons");
  } catch {
    return { error: "Requires manage_seasons permission" };
  }

  const { data: season } = await supabase
    .from("seasons")
    .select("id")
    .eq("id", seasonId)
    .eq("community_id", communityId)
    .single();
  if (!season) return { error: "Season not found in this community" };

  // Get existing tiers to determine current max and xp step.
  const { data: existingTiers } = await supabase
    .from("battle_pass_tiers")
    .select("tier_number, xp_required")
    .eq("season_id", seasonId)
    .order("tier_number", { ascending: true });

  const currentMax = existingTiers && existingTiers.length > 0
    ? Math.max(...existingTiers.map((t) => t.tier_number))
    : 0;

  if (maxLevel <= currentMax) {
    return { error: `Level count can only be increased (current: ${currentMax})` };
  }

  // If tiers exist, validate xpPerLevel matches the existing step.
  if (existingTiers && existingTiers.length > 0) {
    const existingStep = Math.round(existingTiers[0].xp_required / existingTiers[0].tier_number);
    if (existingStep !== xpPerLevel) {
      return { error: `XP per level cannot be changed (currently ${existingStep})` };
    }
  }

  // Insert new tiers from (currentMax + 1) to maxLevel.
  const newTiers = [];
  for (let n = currentMax + 1; n <= maxLevel; n++) {
    newTiers.push({
      season_id: seasonId,
      tier_number: n,
      xp_required: n * xpPerLevel,
      reward_label: "",
    });
  }

  const { error } = await supabase.from("battle_pass_tiers").insert(newTiers);
  if (error) return { error: error.message };
  return { data: { success: true } };
}

// ── Create battle pass tier (admin+) ───────────────────────────
export async function createBattlePassTier(
  communityId: string,
  seasonId: string,
  payload: { tier_number: number; xp_required: number; reward_label: string }
) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  try {
    await requirePermission(supabase, communityId, user.id, "manage_seasons");
  } catch {
    return { error: "Requires manage_seasons permission" };
  }

  // Verify the season belongs to this community.
  const { data: season } = await supabase
    .from("seasons")
    .select("id")
    .eq("id", seasonId)
    .eq("community_id", communityId)
    .single();
  if (!season) return { error: "Season not found in this community" };

  const { data, error } = await supabase
    .from("battle_pass_tiers")
    .insert({
      season_id: seasonId,
      tier_number: payload.tier_number,
      xp_required: payload.xp_required,
      reward_label: payload.reward_label,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  return { data };
}
