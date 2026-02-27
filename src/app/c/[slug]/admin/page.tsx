import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { getCommunityBySlug, getMembership, meetsRole } from "@/lib/rbac";
import { AdminPanel } from "./admin-panel";

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
  if (!membership || !meetsRole(membership.role, "admin")) {
    redirect(`/c/${slug}`);
  }

  // Fetch seasons for this community.
  const { data: seasons } = await supabase
    .from("seasons")
    .select("*, battle_pass_tiers(*)")
    .eq("community_id", community.id)
    .order("created_at", { ascending: false });

  return (
    <AdminPanel
      communityId={community.id}
      slug={slug}
      seasons={seasons ?? []}
    />
  );
}
