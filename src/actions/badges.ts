"use server";

import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { requireRole, requirePermission } from "@/lib/rbac";

// ── Create badge (admin+) ──────────────────────────────────────
export async function createBadge(
  communityId: string,
  payload: { name: string; description?: string; icon_url?: string }
) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  try {
    await requirePermission(supabase, communityId, user.id, "manage_badges");
  } catch {
    return { error: "Requires manage_badges permission" };
  }

  const { data, error } = await supabase
    .from("badges")
    .insert({
      community_id: communityId,
      name: payload.name,
      description: payload.description ?? "",
      icon_url: payload.icon_url ?? "",
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  return { data };
}

// ── Award badge to user (mentor+) + 25 XP ─────────────────────
export async function awardBadge(
  communityId: string,
  badgeId: string,
  targetUserId: string
) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  await requireRole(supabase, communityId, user.id, "mentor");

  // Insert badge award.
  const { data: award, error: awardErr } = await supabase
    .from("badge_awards")
    .insert({
      badge_id: badgeId,
      community_id: communityId,
      user_id: targetUserId,
      awarded_by: user.id,
    })
    .select("id")
    .single();

  if (awardErr) {
    if (awardErr.code === "23505") return { error: "Badge already awarded to this user." };
    return { error: awardErr.message };
  }

  // Find active season.
  const { data: activeSeason } = await supabase
    .from("seasons")
    .select("id")
    .eq("community_id", communityId)
    .eq("is_active", true)
    .single();

  // Queue +25 XP in pending_xp — user claims it for the dopamine hit.
  await supabase.from("pending_xp").insert({
    community_id: communityId,
    user_id: targetUserId,
    season_id: activeSeason?.id ?? null,
    amount: 25,
    reason: "badge_award",
    reference_id: award.id,
  });

  // Audit log.
  await supabase.from("audit_log").insert({
    community_id: communityId,
    actor_id: user.id,
    action: "badge_awarded",
    target_user_id: targetUserId,
    metadata: { badge_id: badgeId, award_id: award.id },
  });

  return { data: { success: true } };
}

// ── List badges for a community ────────────────────────────────
export async function listBadges(communityId: string) {
  const supabase = await getSupabaseServerClient();
  const { data } = await supabase
    .from("badges")
    .select("*")
    .eq("community_id", communityId)
    .order("created_at", { ascending: false });
  return data ?? [];
}
