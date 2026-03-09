import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { getCommunityBySlug, getMembership } from "@/lib/rbac";
import { listPosts } from "@/actions/posts";
import { FeedClient } from "./feed-client";

export default async function FeedPage({
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
  if (!membership) redirect(`/c/${slug}`);

  const posts = await listPosts(community.id, community.name_display_mode);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="border-b border-white/[0.06] px-8 py-5">
        <h1 className="text-lg font-semibold text-white">Feed</h1>
        <p className="mt-0.5 text-sm text-gray-600">Community thoughts and discussions</p>
      </div>
      <div className="px-8 py-6">
        <FeedClient
          communityId={community.id}
          slug={slug}
          currentUserId={user.id}
          initialPosts={posts}
        />
      </div>
    </div>
  );
}
