import { redirect } from "next/navigation";
import Link from "next/link";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { getCommunityBySlug, getMembership } from "@/lib/rbac";
import { listChannels } from "@/actions/chat";

/* ── Tiny inline SVG icons ───────────────────────────────────── */
const Icon = {
  Home: () => <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>,
  Calendar: () => <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
  Hash: () => <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" /></svg>,
  Trophy: () => <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /></svg>,
  Star: () => <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>,
  Shield: () => <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>,
  User: () => <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
  Back: () => <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>,
};

function SidebarSection({ label }: { label: string }) {
  return (
    <div className="mb-1 mt-4 px-3">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-700">{label}</p>
    </div>
  );
}

function NavLink({ href, icon, children }: { href: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-gray-500 transition-all duration-150 hover:bg-white/[0.05] hover:text-gray-200"
    >
      <span className="shrink-0 opacity-70">{icon}</span>
      {children}
    </Link>
  );
}

/* ─────────────────────────────────────────────────────────────── */

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
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-600/20 text-3xl font-bold text-indigo-300">
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
  const channels = await listChannels(community.id);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* ── Sidebar ─────────────────────────────────────────── */}
      <aside className="flex w-60 shrink-0 flex-col border-r border-white/[0.06] bg-[#0e0e18]">

        {/* Community name */}
        <div className="border-b border-white/[0.06] px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600/25 text-sm font-bold text-indigo-300">
              {community.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{community.name}</p>
              <p className="text-xs text-gray-700">/{slug}</p>
            </div>
          </div>
        </div>

        {/* Nav links */}
        <nav className="flex-1 overflow-y-auto px-2 py-3">
          <NavLink href={base} icon={<Icon.Home />}>Dashboard</NavLink>
          <NavLink href={`${base}/events`} icon={<Icon.Calendar />}>Events</NavLink>

          <SidebarSection label="Channels" />
          {channels.length === 0 ? (
            <p className="px-3 py-1 text-xs text-gray-700">No channels yet</p>
          ) : (
            channels.map((ch) => (
              <NavLink key={ch.id} href={`${base}/chat/${ch.id}`} icon={<Icon.Hash />}>
                {ch.name}
              </NavLink>
            ))
          )}

          <SidebarSection label="Progress" />
          <NavLink href={`${base}/leaderboard`} icon={<Icon.Trophy />}>Leaderboard</NavLink>
          <NavLink href={`${base}/battlepass`} icon={<Icon.Star />}>Battle Pass</NavLink>

          {isMentor && (
            <>
              <SidebarSection label="Management" />
              <NavLink href={`${base}/admin`} icon={<Icon.Shield />}>Management</NavLink>
            </>
          )}
        </nav>

        {/* User footer */}
        <div className="border-t border-white/[0.06] px-3 py-3 space-y-0.5">
          <Link
            href={`${base}/profile/${user.id}`}
            className="flex items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-white/[0.05] transition-colors"
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-600/30 text-indigo-300">
              <Icon.User />
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-gray-400">My Profile</p>
              <p className="text-[10px] capitalize text-gray-700">{membership.role}</p>
            </div>
          </Link>
          <Link
            href="/communities"
            className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-gray-700 hover:text-gray-500 transition-colors"
          >
            <Icon.Back /> All communities
          </Link>
        </div>
      </aside>

      {/* ── Main ─────────────────────────────────────────────── */}
      <main className="flex flex-1 flex-col overflow-hidden">
        {children}
      </main>
    </div>
  );
}
