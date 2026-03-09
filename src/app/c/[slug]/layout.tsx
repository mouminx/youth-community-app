import { redirect } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { getCommunityBySlug, getMembership } from "@/lib/rbac";
import { listChannels } from "@/actions/chat";
import { getUnreadCounts } from "@/actions/notifications";
import { getCurrencyBalance } from "@/actions/currency";
import { SidebarNav } from "./sidebar-nav";
import { SidebarShell } from "./sidebar-shell";

const BackIcon = () => <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>;

export default async function CommunityLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const community = await getCommunityBySlug(supabase, slug);
  const membership = await getMembership(supabase, community.id, user.id);

  /* Not a member */
  if (!membership) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4">
        <div className="flex h-16 w-16 items-center justify-center bg-indigo-600/20 text-3xl font-bold text-indigo-300">
          {community.name.charAt(0).toUpperCase()}
        </div>
        <div className="text-center">
          <h1 className="text-xl font-bold text-white">{community.name}</h1>
          <p className="mt-1 text-sm text-gray-500">You are not a member of this community.</p>
        </div>
        <form
          action={async () => {
            "use server";
            const supabase = await getSupabaseServerClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            await supabase.from("memberships").insert({
              community_id: community.id,
              user_id: user.id,
              role: "member",
            });
            redirect(`/c/${slug}`);
          }}
        >
          <button type="submit" className="btn-primary">Join community</button>
        </form>
        <Link href="/communities" className="text-sm text-gray-500 hover:text-gray-300 transition-colors">
          ← Back to communities
        </Link>
      </div>
    );
  }

  const isMentor = ["owner", "admin", "mentor"].includes(membership.role);
  const base = `/c/${slug}`;

  // Profile completion gate: redirect users without a username to their profile.
  const pathname = (await headers()).get("x-pathname") ?? "";
  if (!pathname.includes("/profile/")) {
    const { data: userProfile } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", user.id)
      .single();
    if (!userProfile?.username) {
      redirect(`/c/${slug}/profile/${user.id}?setup=1`);
    }
  }

  const [channels, unreadCounts, currencyBalance] = await Promise.all([
    listChannels(community.id),
    getUnreadCounts(community.id),
    getCurrencyBalance(community.id),
  ]);

  return (
    <SidebarShell
      communityName={community.name}
      themeKey={community.theme_key ?? "ascnd"}
      sidebarContent={
        <>
          {/* Community name */}
          <div className="border-b border-white/[0.06] px-4 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center bg-indigo-600/25 text-sm font-bold text-indigo-300">
                {community.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 pr-6 md:pr-0">
                <p className="truncate text-sm font-semibold text-white">{community.name}</p>
                <p className="text-xs text-gray-700">/{slug}</p>
              </div>
            </div>
          </div>

          {/* Nav links */}
          <nav className="flex-1 overflow-y-auto px-2 py-3">
            <SidebarNav
              channels={channels}
              base={base}
              isMentor={isMentor}
              communityId={community.id}
              initialUnreadCounts={unreadCounts}
              currencyBalance={currencyBalance}
              userId={user.id}
              userRole={membership.role}
            />
          </nav>

          {/* Footer */}
          <div className="border-t border-white/[0.06] px-3 py-3 space-y-0.5">
            <Link
              href="/communities"
              className="flex items-center gap-1.5 px-2 py-1.5 text-xs text-gray-700 hover:text-gray-500 transition-colors"
            >
              <BackIcon /> All communities
            </Link>
            <form action={async () => {
              "use server";
              const supabase = await getSupabaseServerClient();
              await supabase.auth.signOut();
              redirect("/login");
            }}>
              <button
                type="submit"
                className="flex w-full items-center gap-1.5 px-2 py-1.5 text-xs text-gray-700 hover:text-red-400 transition-colors"
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Sign out
              </button>
            </form>
          </div>
        </>
      }
    >
      {children}
    </SidebarShell>
  );
}
