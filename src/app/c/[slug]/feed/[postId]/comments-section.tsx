"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createComment, type Comment } from "@/actions/posts";

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

function CommentInput({
  postId,
  parentId,
  placeholder,
  onSuccess,
  onCancel,
  compact,
}: {
  postId: string;
  parentId?: string;
  placeholder: string;
  onSuccess: () => void;
  onCancel?: () => void;
  compact?: boolean;
}) {
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setError("");
    startTransition(async () => {
      const res = await createComment(postId, body, parentId);
      if ("error" in res && res.error) {
        setError(res.error);
      } else {
        setBody("");
        onSuccess();
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <textarea
        className={`input resize-none ${compact ? "min-h-[64px]" : "min-h-[88px]"}`}
        placeholder={placeholder}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onPaste={(e) => e.preventDefault()}
        rows={compact ? 2 : 3}
        maxLength={2000}
        required
      />
      <p className="text-xs text-gray-700">
        Write your own thoughts — pasting is disabled.
      </p>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending || !body.trim()}
          className="btn-primary btn-sm"
        >
          {isPending ? "Posting…" : compact ? "Reply" : "Comment"}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn-ghost btn-sm">
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

function ReplyThread({
  replies,
}: {
  replies: Comment[];
}) {
  if (replies.length === 0) return null;
  return (
    <div className="mt-3 space-y-3 pl-4 border-l border-white/[0.06]">
      {replies.map((reply) => (
        <div key={reply.id}>
          <p className="text-xs text-gray-600">
            {reply.author_name} · {timeAgo(reply.created_at)}
          </p>
          <p className="mt-1 text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">
            {reply.body}
          </p>
        </div>
      ))}
    </div>
  );
}

function CommentRow({
  comment,
  replies,
  postId,
  onRefresh,
}: {
  comment: Comment;
  replies: Comment[];
  postId: string;
  onRefresh: () => void;
}) {
  const [showReply, setShowReply] = useState(false);

  return (
    <div className="py-4 border-b border-white/[0.04] last:border-0">
      <p className="text-xs text-gray-600">
        {comment.author_name} · {timeAgo(comment.created_at)}
      </p>
      <p className="mt-1 text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">
        {comment.body}
      </p>

      {/* Reply thread */}
      <ReplyThread replies={replies} />

      {/* Reply toggle */}
      {!showReply && (
        <button
          onClick={() => setShowReply(true)}
          className="mt-2 text-xs text-gray-600 hover:text-gray-400 transition-colors"
        >
          Reply
        </button>
      )}

      {showReply && (
        <div className="mt-3 pl-4 border-l border-white/[0.06]">
          <CommentInput
            postId={postId}
            parentId={comment.id}
            placeholder={`Reply to ${comment.author_name}…`}
            compact
            onSuccess={() => {
              setShowReply(false);
              onRefresh();
            }}
            onCancel={() => setShowReply(false)}
          />
        </div>
      )}
    </div>
  );
}

export function CommentsSection({
  postId,
  initialComments,
  currentUserId,
}: {
  postId: string;
  initialComments: Comment[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [comments, setComments] = useState<Comment[]>(initialComments);

  const topLevel = comments.filter((c) => c.parent_id === null);
  const repliesFor = (commentId: string) =>
    comments.filter((c) => c.parent_id === commentId);

  function refresh() {
    router.refresh();
  }

  return (
    <div className="space-y-0">
      {/* Comment list */}
      {topLevel.length === 0 ? (
        <p className="text-sm text-gray-600 py-4">
          No comments yet. Be the first to share your thoughts!
        </p>
      ) : (
        <div className="card mb-4">
          <div className="divide-y divide-white/[0.04] px-5">
            {topLevel.map((comment) => (
              <CommentRow
                key={comment.id}
                comment={comment}
                replies={repliesFor(comment.id)}
                postId={postId}
                onRefresh={refresh}
              />
            ))}
          </div>
        </div>
      )}

      {/* New comment form */}
      <div className="card p-5">
        <p className="label mb-3">Leave a comment</p>
        <CommentInput
          postId={postId}
          placeholder="Share your thoughts…"
          onSuccess={refresh}
        />
      </div>
    </div>
  );
}
