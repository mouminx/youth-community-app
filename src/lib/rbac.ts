import { SupabaseClient } from "@supabase/supabase-js";

export type CommunityRole = "owner" | "admin" | "mentor" | "member";

// Role hierarchy: owner > admin > mentor > member.
const ROLE_RANK: Record<CommunityRole, number> = {
  owner: 0,
  admin: 1,
  mentor: 2,
  member: 3,
};

// Returns the user's membership row for a community, or null.
export async function getMembership(
  supabase: SupabaseClient,
  communityId: string,
  userId: string
) {
  const { data } = await supabase
    .from("memberships")
    .select("id, role")
    .eq("community_id", communityId)
    .eq("user_id", userId)
    .single();
  return data as { id: string; role: CommunityRole } | null;
}

// Check if role meets the minimum required level.
export function meetsRole(
  userRole: CommunityRole,
  minRole: CommunityRole
): boolean {
  return ROLE_RANK[userRole] <= ROLE_RANK[minRole];
}

// Convenience: requires the user to be at least `minRole` in the community.
// Returns the membership or throws.
export async function requireRole(
  supabase: SupabaseClient,
  communityId: string,
  userId: string,
  minRole: CommunityRole
) {
  const membership = await getMembership(supabase, communityId, userId);
  if (!membership || !meetsRole(membership.role, minRole)) {
    throw new Error(`Requires ${minRole}+ role`);
  }
  return membership;
}

// Resolve community by slug, returns { id, name, slug, description }.
export async function getCommunityBySlug(
  supabase: SupabaseClient,
  slug: string
) {
  const { data, error } = await supabase
    .from("communities")
    .select("id, name, slug, description")
    .eq("slug", slug)
    .single();
  if (error || !data) throw new Error("Community not found");
  return data as { id: string; name: string; slug: string; description: string };
}
