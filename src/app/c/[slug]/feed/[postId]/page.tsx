import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { getCommunityBySlug, getMembership } from "@/lib/rbac";
import { getPost, listComments } from "@/actions/posts";
import { PostReactions } from "./post-reactions";
import { CommentsSection } from "./comments-section";

export default async function PostPage({
  params,
}: {
  params: Promise<{ slug: string; postId: string }>;
}) {
  const { slug, postId } = await params;
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const community = await getCommunityBySlug(supabase, slug);
  const membership = await getMembership(supabase, community.id, user.id);
  if (!membership) redirect(`/c/${slug}`);

  const [post, comments] = await Promise.all([
    getPost(postId, community.name_display_mode),
    listComments(postId, community.name_display_mode),
  ]);
  if (!post) notFound();

  const isOwnPost = user.id === post.author_id;

  const date = new Date(post.created_at).toLocaleDateString("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="border-b border-white/[0.06] px-8 py-5">
        <Link
          href={`/c/${slug}/feed`}
          className="mb-3 inline-flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-400 transition-colors"
        >
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Feed
        </Link>
        <h1 className="text-lg font-semibold text-white">{post.title}</h1>
        <p className="mt-0.5 text-sm text-gray-600">
          {post.author_name}{isOwnPost && <span className="text-gray-700"> (you)</span>} · {date}
        </p>
      </div>

      <div className="px-8 py-6 max-w-3xl space-y-6">
        {/* Post body */}
        <div className="card p-6">
          <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{post.body}</p>
        </div>

        {/* Reactions */}
        <div>
          <p className="label mb-3">Reactions</p>
          <PostReactions post={post} currentUserId={user.id} isOwnPost={isOwnPost} />
        </div>

        {/* Comments */}
        <div>
          <p className="label mb-3">
            {comments.length > 0 ? `${comments.length} Comment${comments.length === 1 ? "" : "s"}` : "Comments"}
          </p>
          <CommentsSection
            postId={post.id}
            initialComments={comments}
            currentUserId={user.id}
          />
        </div>
      </div>
    </div>
  );
}
