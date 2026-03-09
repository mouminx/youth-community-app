import { redirect } from "next/navigation";
import Link from "next/link";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { getCommunityBySlug, getMembership } from "@/lib/rbac";

const ROLE_BADGE: Record<string, string> = {
  owner: "badge-amber", admin: "badge-indigo", mentor: "badge-green", member: "badge-gray",
};

export default async function CommunityDashboard({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const community = await getCommunityBySlug(supabase, slug);
  const membership = await getMembership(supabase, community.id, user.id);
  if (!membership) redirect(`/c/${slug}`);

  const base = `/c/${slug}`;

  const [{ count: memberCount }, { count: eventCount }, { data: xpRows }] = await Promise.all([
    supabase.from("memberships").select("*", { count: "exact", head: true }).eq("community_id", community.id),
    supabase.from("events").select("*", { count: "exact", head: true }).eq("community_id", community.id),
    supabase.from("xp_transactions").select("amount").eq("community_id", community.id).eq("user_id", user.id),
  ]);

  const myXp = (xpRows ?? []).reduce((s, r) => s + r.amount, 0);

  // Upcoming events (next 3)
  const { data: upcoming } = await supabase
    .from("events")
    .select("id, title, start_time, location")
    .eq("community_id", community.id)
    .gte("start_time", new Date().toISOString())
    .order("start_time", { ascending: true })
    .limit(3);

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Page header */}
      <div className="border-b border-white/[0.06] px-8 py-5">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-white">Dashboard</h1>
          <span className={ROLE_BADGE[membership.role] ?? "badge-gray"}>{membership.role}</span>
        </div>
        <p className="mt-0.5 text-sm text-gray-600">{community.description || `Welcome to ${community.name}`}</p>
      </div>

      <div className="px-8 py-6 space-y-8">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <StatCard
            label="Total Members"
            value={memberCount ?? 0}
            icon={
              <svg className="h-5 w-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            }
            color="indigo"
          />
          <StatCard
            label="Events Created"
            value={eventCount ?? 0}
            icon={
              <svg className="h-5 w-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            }
            color="emerald"
          />
          <StatCard
            label="Your XP"
            value={`${myXp} XP`}
            icon={
              <svg className="h-5 w-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            }
            color="amber"
          />
        </div>

        {/* Upcoming events */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Upcoming Events</h2>
            <Link href={`${base}/events`} className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
              View all →
            </Link>
          </div>
          {!upcoming || upcoming.length === 0 ? (
            <div className="card flex flex-col items-center gap-3 py-10 text-center">
              <svg className="h-8 w-8 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              <p className="text-sm text-gray-600">No upcoming events scheduled.</p>
              <Link href={`${base}/events`} className="btn-ghost btn-sm">Go to Events</Link>
            </div>
          ) : (
            <div className="space-y-2">
              {upcoming.map((ev) => (
                <div key={ev.id} className="card flex items-center gap-4 px-4 py-3">
                  <div className="shrink-0 rounded-lg bg-indigo-600/10 p-2.5 text-center">
                    <p className="text-xs font-bold text-indigo-300 leading-none">
                      {new Date(ev.start_time).toLocaleDateString("en", { month: "short" }).toUpperCase()}
                    </p>
                    <p className="text-lg font-bold text-indigo-200 leading-tight">
                      {new Date(ev.start_time).getDate()}
                    </p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-white">{ev.title}</p>
                    <p className="text-xs text-gray-600">
                      {new Date(ev.start_time).toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" })}
                      {ev.location ? ` · ${ev.location}` : ""}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Quick links */}
        <section>
          <h2 className="mb-4 text-sm font-semibold text-white">Quick Access</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { href: `${base}/leaderboard`, label: "Ladder", color: "amber" },
              { href: `${base}/battlepass`, label: "Seasonal Climb", color: "indigo" },
              { href: `${base}/events`, label: "Events", color: "emerald" },
              { href: `${base}/profile/${user.id}`, label: "My Profile", color: "purple" },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="card flex items-center justify-center py-4 text-sm font-medium text-gray-400 hover:border-white/[0.14] hover:text-gray-200 transition-all"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function StatCard({
  label, value, icon, color,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: "indigo" | "emerald" | "amber";
}) {
  const bg = { indigo: "bg-indigo-600/10", emerald: "bg-emerald-600/10", amber: "bg-amber-600/10" }[color];
  return (
    <div className="card px-5 py-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-gray-600">{label}</p>
        <div className={`rounded-lg p-2 ${bg}`}>{icon}</div>
      </div>
      <p className="mt-3 text-2xl font-bold text-white">{value}</p>
    </div>
  );
}
