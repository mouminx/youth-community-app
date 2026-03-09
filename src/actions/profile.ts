"use server";

import { getSupabaseServerClient } from "@/lib/supabaseServer";
import type { AvatarOptions } from "@/lib/dicebear";

export type ProfileData = {
  id: string;
  display_name: string;
  avatar_seed: string;
  avatar_bg: string;
  role: string;
  career_xp: number;
  badge_count: number;
};

export async function getProfile(
  communityId: string,
  targetUserId: string
): Promise<ProfileData | null> {
  const supabase = await getSupabaseServerClient();

  const [profileRes, membershipRes, careerXpRes, badgeCountRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, display_name, avatar_seed, avatar_bg")
      .eq("id", targetUserId)
      .single(),
    supabase
      .from("memberships")
      .select("role")
      .eq("community_id", communityId)
      .eq("user_id", targetUserId)
      .single(),
    supabase
      .from("xp_transactions")
      .select("amount")
      .eq("community_id", communityId)
      .eq("user_id", targetUserId),
    supabase
      .from("badge_awards")
      .select("id", { count: "exact", head: true })
      .eq("community_id", communityId)
      .eq("user_id", targetUserId),
  ]);

  if (!profileRes.data || !membershipRes.data) return null;

  const careerXp = (careerXpRes.data ?? []).reduce((sum, t) => sum + t.amount, 0);

  return {
    id: profileRes.data.id,
    display_name: profileRes.data.display_name || "Member",
    avatar_seed: profileRes.data.avatar_seed || targetUserId,
    avatar_bg: profileRes.data.avatar_bg || "0b1020",
    role: membershipRes.data.role,
    career_xp: careerXp,
    badge_count: badgeCountRes.count ?? 0,
  };
}

export async function updateProfileInfo(
  firstName: string,
  lastName: string,
  username: string,
  displayName: string
): Promise<{ error: string } | { success: true }> {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const trimmed = username.trim().toLowerCase();
  if (!/^[a-z0-9_]{3,20}$/.test(trimmed)) {
    return { error: "Username must be 3–20 characters and contain only letters, numbers, or underscores." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      username: trimmed,
      display_name: displayName.trim() || trimmed,
    })
    .eq("id", user.id);

  if (error) {
    if (error.code === "23505") return { error: "Username already taken." };
    return { error: error.message };
  }
  return { success: true };
}

export async function updateAvatar(
  seed: string,
  bg: string,
  opts: AvatarOptions = {}
): Promise<{ error: string } | { success: true }> {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("profiles")
    .update({ avatar_seed: seed, avatar_bg: bg, avatar_options: opts })
    .eq("id", user.id);

  if (error) return { error: error.message };
  return { success: true };
}
