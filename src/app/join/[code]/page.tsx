import { redirect } from "next/navigation";
import Link from "next/link";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { getInviteInfo, useInviteCode } from "@/actions/invites";

export default async function JoinPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const info = await getInviteInfo(code);

  if ("error" in info || !info.data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
        <div className="card flex flex-col items-center gap-3 px-8 py-12 text-center">
          <svg className="h-8 w-8 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
          <p className="text-sm font-medium text-white">Invalid invite link</p>
          <p className="text-xs text-gray-600">This link may have been deactivated or doesn&apos;t exist.</p>
          <Link href="/communities" className="btn-ghost btn-sm mt-2">Go to my communities</Link>
        </div>
      </div>
    );
  }

  const { community_name, community_slug, community_description } = info.data;

  // If logged in, handle join immediately via a server action form.
  async function handleJoin() {
    "use server";
    const res = await useInviteCode(code);
    if ("error" in res || !res.data) {
      // Can't redirect to an error UI cleanly from a server action without state —
      // fall through to the redirect below if already a member, else redirect home.
      redirect("/communities");
    }
    redirect(`/c/${res.data.community_slug}`);
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4">
      {/* Community avatar */}
      <div
        className="flex h-20 w-20 items-center justify-center rounded-2xl text-3xl font-bold text-white"
        style={{ background: "color-mix(in srgb, var(--neon-cyan, #6366f1) 20%, #111119)" }}
      >
        {community_name.charAt(0).toUpperCase()}
      </div>

      <div className="text-center">
        <h1 className="text-2xl font-bold text-white">{community_name}</h1>
        {community_description && (
          <p className="mt-1.5 max-w-xs text-sm text-gray-500">{community_description}</p>
        )}
        <p className="mt-3 text-xs text-gray-700">You&apos;ve been invited to join this community.</p>
      </div>

      <div className="flex flex-col items-center gap-3">
        {user ? (
          <form action={handleJoin}>
            <button type="submit" className="btn-primary px-8 py-2.5 text-sm font-semibold">
              Join Community
            </button>
          </form>
        ) : (
          <>
            <Link href="/login" className="btn-primary px-8 py-2.5 text-sm font-semibold">
              Sign in to Join
            </Link>
            <p className="text-xs text-gray-700">
              Don&apos;t have an account?{" "}
              <Link href="/login" className="text-indigo-400 hover:text-indigo-300 transition-colors">
                Create one
              </Link>
            </p>
          </>
        )}
      </div>

      <div className="text-center">
        <Link href="/communities" className="text-xs text-gray-700 hover:text-gray-500 transition-colors">
          Back to my communities
        </Link>
      </div>
    </div>
  );
}
