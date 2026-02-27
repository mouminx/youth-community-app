import Link from "next/link";
import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { CreateCommunityForm } from "./create-form";

export const dynamic = "force-dynamic";

const ROLE_BADGE: Record<string, string> = {
  owner:  "badge-amber",
  admin:  "badge-indigo",
  mentor: "badge-green",
  member: "badge-gray",
};

export default async function CommunitiesPage() {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: memberships } = await supabase
    .from("memberships")
    .select("role, community:communities(id, name, slug, description)")
    .eq("user_id", user.id);

  const communities = (memberships ?? []).map((m: any) => ({
    ...m.community,
    role: m.role as string,
  }));

  return (
    <div className="flex min-h-screen flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-10 border-b border-white/[0.06] bg-[#0b0b12]/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600">
              <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <span className="font-semibold text-white">Youth Community</span>
          </div>
          <SignOutButton />
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">Your Communities</h1>
          <p className="mt-1 text-sm text-gray-500">
            {communities.length === 0
              ? "You haven't joined any communities yet."
              : `Member of ${communities.length} community${communities.length !== 1 ? "s" : ""}.`}
          </p>
        </div>

        {/* Community grid */}
        {communities.length > 0 && (
          <div className="mb-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {communities.map((c) => (
              <Link
                key={c.id}
                href={`/c/${c.slug}`}
                className="group card flex flex-col gap-3 p-5 transition-all duration-200 hover:border-indigo-500/30 hover:bg-[#151520]"
              >
                <div className="flex items-center justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600/20 text-lg font-bold text-indigo-300">
                    {c.name.charAt(0).toUpperCase()}
                  </div>
                  <span className={ROLE_BADGE[c.role] ?? "badge-gray"}>{c.role}</span>
                </div>
                <div>
                  <p className="font-semibold text-white group-hover:text-indigo-200 transition-colors">{c.name}</p>
                  <p className="mt-0.5 text-xs text-gray-600">/{c.slug}</p>
                  {c.description && (
                    <p className="mt-1.5 text-xs text-gray-500 line-clamp-2">{c.description}</p>
                  )}
                </div>
                <div className="mt-auto flex items-center gap-1 text-xs text-indigo-400 opacity-0 transition-opacity group-hover:opacity-100">
                  Open
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Create form */}
        <div className="card p-6">
          <h2 className="mb-5 text-base font-semibold text-white">
            {communities.length === 0 ? "Create your first community" : "Create a new community"}
          </h2>
          <CreateCommunityForm />
        </div>
      </main>
    </div>
  );
}

function SignOutButton() {
  return (
    <form
      action={async () => {
        "use server";
        const supabase = await getSupabaseServerClient();
        await supabase.auth.signOut();
        redirect("/login");
      }}
    >
      <button type="submit" className="btn-ghost btn-sm">Sign out</button>
    </form>
  );
}
