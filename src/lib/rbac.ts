import { SupabaseClient } from "@supabase/supabase-js";

export type CommunityRole = "owner" | "admin" | "mentor" | "member";

export type GrantablePermission =
  | "manage_seasons"
  | "manage_badges"
  | "manage_channels"
  | "manage_members";

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

// Requires the user to be at least `minRole` in the community. Returns the
// membership or throws (caught by caller and returned as { error }).
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

// Returns the list of grantable permissions held by a user in a community.
// Admin+ always hold all four inherently; this queries for explicit grants
// given to mentors (or as future-proofing for other roles).
export async function getUserPermissions(
  supabase: SupabaseClient,
  communityId: string,
  userId: string
): Promise<GrantablePermission[]> {
  const { data } = await supabase
    .from("community_permissions")
    .select("permission")
    .eq("community_id", communityId)
    .eq("user_id", userId);
  return (data ?? []).map((r) => r.permission as GrantablePermission);
}

// Pure check: does this role + explicit grants cover the given permission?
// Admin+ always returns true regardless of the grants array.
export function canAccess(
  role: CommunityRole,
  grantedPermissions: GrantablePermission[],
  permission: GrantablePermission
): boolean {
  if (meetsRole(role, "admin")) return true;
  return grantedPermissions.includes(permission);
}

// Requires the user to have the given permission (by role or explicit grant).
// Returns the membership or throws.
export async function requirePermission(
  supabase: SupabaseClient,
  communityId: string,
  userId: string,
  permission: GrantablePermission
) {
  const membership = await getMembership(supabase, communityId, userId);
  if (!membership) throw new Error("Not a member");
  if (meetsRole(membership.role, "admin")) return membership; // admin+ passes
  const perms = await getUserPermissions(supabase, communityId, userId);
  if (!perms.includes(permission)) {
    throw new Error(`Requires ${permission} permission`);
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
