import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import {
  getCommunityBySlug,
  getMembership,
  meetsRole,
  getUserPermissions,
  type CommunityRole,
  type GrantablePermission,
} from "@/lib/rbac";
import { ManagementPanel } from "./admin-panel";
import { listTrophiesWithAwards } from "@/actions/trophies";

export default async function AdminPage({
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

  // Mentors and above can access Management.
  if (!membership || !meetsRole(membership.role, "mentor")) {
    redirect(`/c/${slug}`);
  }

  const isAdmin = meetsRole(membership.role, "admin");

  // Effective permissions: admin+ hold all four inherently.
  const grantedPermissions: GrantablePermission[] = isAdmin
    ? ["manage_seasons", "manage_badges", "manage_channels", "manage_members"]
    : await getUserPermissions(supabase, community.id, user.id);

  // For mentors: which permissions already have a pending request?
  const myPendingRequests: GrantablePermission[] = [];
  if (!isAdmin) {
    const { data: pending } = await supabase
      .from("permission_requests")
      .select("permission")
      .eq("community_id", community.id)
      .eq("requester_id", user.id)
      .eq("status", "pending");
    myPendingRequests.push(
      ...((pending ?? []).map((r) => r.permission as GrantablePermission))
    );
  }

  // Fetch core data in parallel (all community members can read these).
  const [seasonsResult, badgesResult, membersResult, trophies] = await Promise.all([
    supabase
      .from("seasons")
      .select("*, battle_pass_tiers(*)")
      .eq("community_id", community.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("badges")
      .select("id, name, description")
      .eq("community_id", community.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("memberships")
      .select("id, user_id, role, profiles(display_name)")
      .eq("community_id", community.id)
      .order("role"),
    listTrophiesWithAwards(community.id),
  ]);

  // Admin+ only: pending permission requests and active grants.
  let permissionRequests: {
    id: string;
    requester_id: string;
    permission: string;
    requester_note: string;
    created_at: string;
  }[] = [];
  let grants: {
    id: string;
    user_id: string;
    permission: string;
    granted_at: string;
  }[] = [];

  let inviteCodes: {
    id: string;
    code: string;
    label: string | null;
    use_count: number;
    is_active: boolean;
    created_at: string;
  }[] = [];

  if (isAdmin) {
    const [reqResult, grantsResult, inviteResult] = await Promise.all([
      supabase
        .from("permission_requests")
        .select("id, requester_id, permission, requester_note, created_at")
        .eq("community_id", community.id)
        .eq("status", "pending")
        .order("created_at"),
      supabase
        .from("community_permissions")
        .select("id, user_id, permission, granted_at")
        .eq("community_id", community.id)
        .order("granted_at"),
      supabase
        .from("invite_codes")
        .select("id, code, label, use_count, is_active, created_at")
        .eq("community_id", community.id)
        .order("created_at", { ascending: false }),
    ]);
    permissionRequests = reqResult.data ?? [];
    grants = grantsResult.data ?? [];
    inviteCodes = inviteResult.data ?? [];
  }

  return (
    <ManagementPanel
      communityId={community.id}
      slug={slug}
      role={membership.role as CommunityRole}
      grantedPermissions={grantedPermissions}
      myPendingRequests={myPendingRequests}
      seasons={seasonsResult.data ?? []}
      badges={badgesResult.data ?? []}
      trophies={trophies}
      members={
        (membersResult.data ?? []) as unknown as {
          id: string;
          user_id: string;
          role: CommunityRole;
          profiles: { display_name: string } | null;
        }[]
      }
      permissionRequests={permissionRequests}
      grants={grants}
      inviteCodes={inviteCodes}
      currentTheme={community.theme_key ?? "ascnd"}
      currentDisplayMode={community.name_display_mode ?? "username"}
    />
  );
}
