import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { getCommunityBySlug, getMembership } from "@/lib/rbac";

const ROLE_BADGE: Record<string, string> = {
  owner: "badge-amber",
  admin: "badge-indigo",
  mentor: "badge-green",
  member: "badge-gray",
};

export default async function ProfilePage({ params }: { params: Promise<{ slug: string; userId: string }> }) {
  const { slug, userId } = await params;
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const community = await getCommunityBySlug(supabase, slug);
  const viewerMembership = await getMembership(supabase, community.id, user.id);
  if (!viewerMembership) redirect("/c/" + slug);

  const [{ data: profile }, membership] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).single(),
    getMembership(supabase, community.id, userId),
  ]);

  if (!profile || !membership) {
    return (
      <div className="flex-1 overflow-y-auto px-8 py-6">
        <p className="text-sm text-gray-600">User not found in this community.</p>
      </div>
    );
  }

  const [{ data: xpRows }, { data: badgeAwards }] = await Promise.all([
    supabase.from("xp_transactions").select("amount").eq("community_id", community.id).eq("user_id", userId),
    supabase.from("badge_awards").select("id, created_at, badges:badges(name, description, icon_url)").eq("community_id", community.id).eq("user_id", userId),
  ]);

  const totalXp = (xpRows ?? []).reduce((s, r) => s + r.amount, 0);
  const isOwnProfile = userId === user.id;

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Profile header */}
      <div className="border-b border-white/[0.06] px-8 py-6">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600/20 text-xl font-bold text-indigo-300">
            {(profile.display_name || "?").charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold text-white">
                {profile.display_name || "Unnamed"}
                {isOwnProfile && <span className="ml-2 text-sm font-normal text-gray-600">(you)</span>}
              </h1>
              <span className={ROLE_BADGE[membership.role] ?? "badge-gray"}>{membership.role}</span>
            </div>
            <p className="mt-0.5 text-sm text-gray-600">{totalXp} XP earned</p>
          </div>
        </div>
      </div>

      <div className="px-8 py-6 space-y-6">
        {/* XP stat */}
        <div className="grid grid-cols-3 gap-4">
          <div className="card px-5 py-4">
            <p className="text-xs font-medium text-gray-600">Total XP</p>
            <p className="mt-2 text-2xl font-bold text-white">{totalXp}</p>
          </div>
          <div className="card px-5 py-4">
            <p className="text-xs font-medium text-gray-600">Badges</p>
            <p className="mt-2 text-2xl font-bold text-white">{(badgeAwards ?? []).length}</p>
          </div>
          <div className="card px-5 py-4">
            <p className="text-xs font-medium text-gray-600">Role</p>
            <p className="mt-2 text-lg font-bold text-white capitalize">{membership.role}</p>
          </div>
        </div>

        {/* Badges */}
        <section>
          <h2 className="mb-3 text-sm font-semibold text-white">Badges</h2>
          {(badgeAwards ?? []).length === 0 ? (
            <div className="card flex flex-col items-center gap-3 py-10 text-center">
              <svg className="h-7 w-7 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
              </svg>
              <p className="text-sm text-gray-600">No badges earned yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {(badgeAwards ?? []).map((ba: any) => (
                <div key={ba.id} className="card flex items-start gap-3 px-4 py-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600/15">
                    <svg className="h-4 w-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">{ba.badges?.name}</p>
                    {ba.badges?.description && (
                      <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">{ba.badges.description}</p>
                    )}
                    <p className="text-xs text-gray-700 mt-1">
                      {new Date(ba.created_at).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
