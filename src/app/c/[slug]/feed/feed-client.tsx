"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createPost, toggleReaction, type Post } from "@/actions/posts";

const EMOJIS = ["👍", "❤️", "🔥", "💡", "✨"];

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function ReactionBar({
  post,
  currentUserId,
  onToggle,
}: {
  post: Post;
  currentUserId: string;
  onToggle: (postId: string, emoji: string) => void;
}) {
  // Authors can't react to their own posts
  if (post.author_id === currentUserId) return null;

  return (
    <div className="flex flex-wrap gap-1.5 mt-3">
      {EMOJIS.map((emoji) => {
        const count = post.reaction_counts[emoji] ?? 0;
        const active = post.my_reactions.includes(emoji);
        return (
          <button
            key={emoji}
            onClick={() => onToggle(post.id, emoji)}
            className={[
              "inline-flex items-center gap-1 px-2.5 py-1 text-sm transition-all duration-150",
              "border",
              active
                ? "border-[rgba(59,232,255,0.55)] bg-[rgba(59,232,255,0.12)] text-[#9dfff4]"
                : "border-white/[0.08] bg-white/[0.03] text-gray-500 hover:border-white/20 hover:text-gray-300",
            ].join(" ")}
          >
            <span>{emoji}</span>
            {count > 0 && <span className="font-mono text-xs">{count}</span>}
          </button>
        );
      })}
    </div>
  );
}

function PostCard({
  post,
  slug,
  currentUserId,
  onToggle,
}: {
  post: Post;
  slug: string;
  currentUserId: string;
  onToggle: (postId: string, emoji: string) => void;
}) {
  const preview = post.body.length > 220 ? post.body.slice(0, 220) + "…" : post.body;
  const href = `/c/${slug}/feed/${post.id}`;

  return (
    <div className="card p-5 relative">
      {/* Invisible overlay link makes the whole card tappable */}
      <Link href={href} className="absolute inset-0" aria-label={post.title} />
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="block text-base font-semibold text-white">{post.title}</p>
          <p className="mt-0.5 text-xs text-gray-600">
            {post.author_name}{post.author_id === currentUserId && <span className="text-gray-700"> (you)</span>} · {timeAgo(post.created_at)}
          </p>
        </div>
      </div>
      <p className="mt-3 text-sm text-gray-400 leading-relaxed whitespace-pre-wrap">{preview}</p>
      {/* Reaction bar sits above the overlay link */}
      <div className="relative z-10">
        <ReactionBar post={post} currentUserId={currentUserId} onToggle={onToggle} />
      </div>
    </div>
  );
}

function NewPostForm({
  communityId,
  onSuccess,
  onCancel,
}: {
  communityId: string;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError("Title is required."); return; }
    if (body.trim().length < 10) { setError("Body must be at least 10 characters."); return; }
    setError("");
    startTransition(async () => {
      const res = await createPost(communityId, title, body);
      if ("error" in res && res.error) {
        setError(res.error);
      } else {
        onSuccess();
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="card p-5 space-y-4">
      <h2 className="text-sm font-semibold text-white uppercase tracking-[0.08em]">New Post</h2>

      <div>
        <label className="label">Title</label>
        <input
          className="input"
          placeholder="Give your post a title…"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
          required
        />
      </div>

      <div>
        <label className="label">Your thoughts</label>
        <textarea
          className="input min-h-[120px] resize-y"
          placeholder="Write your own thoughts here…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onPaste={(e) => e.preventDefault()}
          rows={5}
          required
        />
        <p className="mt-1 text-xs text-gray-600">
          Write your own thoughts — pasting is disabled to keep content authentic.
        </p>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <div className="flex gap-2">
        <button type="submit" disabled={isPending} className="btn-primary btn-sm">
          {isPending ? "Posting…" : "Post"}
        </button>
        <button type="button" onClick={onCancel} className="btn-ghost btn-sm">
          Cancel
        </button>
      </div>
    </form>
  );
}

export function FeedClient({
  communityId,
  slug,
  currentUserId,
  initialPosts,
}: {
  communityId: string;
  slug: string;
  currentUserId: string;
  initialPosts: Post[];
}) {
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [showForm, setShowForm] = useState(false);

  function handleToggle(postId: string, emoji: string) {
    // Optimistic update
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p;
        const hasReacted = p.my_reactions.includes(emoji);
        return {
          ...p,
          my_reactions: hasReacted
            ? p.my_reactions.filter((e) => e !== emoji)
            : [...p.my_reactions, emoji],
          reaction_counts: {
            ...p.reaction_counts,
            [emoji]: (p.reaction_counts[emoji] ?? 0) + (hasReacted ? -1 : 1),
          },
        };
      })
    );
    // Fire-and-forget — server syncs on next navigation
    toggleReaction(postId, emoji);
  }

  function handlePostSuccess() {
    setShowForm(false);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {/* New post trigger */}
      {!showForm && (
        <button onClick={() => setShowForm(true)} className="btn-primary">
          + New Post
        </button>
      )}

      {showForm && (
        <NewPostForm
          communityId={communityId}
          onSuccess={handlePostSuccess}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* Post list */}
      {posts.length === 0 && !showForm && (
        <div className="card flex flex-col items-center gap-3 py-12 text-center">
          <svg className="h-8 w-8 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-sm text-gray-600">No posts yet. Be the first to share something!</p>
        </div>
      )}

      {posts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          slug={slug}
          currentUserId={currentUserId}
          onToggle={handleToggle}
        />
      ))}
    </div>
  );
}
