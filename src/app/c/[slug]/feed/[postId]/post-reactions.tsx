"use client";

import { useState } from "react";
import { toggleReaction, type Post } from "@/actions/posts";

const EMOJIS = ["👍", "❤️", "🔥", "💡", "✨"];

export function PostReactions({
  post: initialPost,
  currentUserId,
  isOwnPost,
}: {
  post: Post;
  currentUserId: string;
  isOwnPost: boolean;
}) {
  const [counts, setCounts] = useState(initialPost.reaction_counts);
  const [myReactions, setMyReactions] = useState(initialPost.my_reactions);

  function handleToggle(emoji: string) {
    if (isOwnPost) return;
    const hasReacted = myReactions.includes(emoji);

    setCounts((prev) => ({
      ...prev,
      [emoji]: (prev[emoji] ?? 0) + (hasReacted ? -1 : 1),
    }));
    setMyReactions((prev) =>
      hasReacted ? prev.filter((e) => e !== emoji) : [...prev, emoji]
    );

    toggleReaction(initialPost.id, emoji);
  }

  // For own posts: show reaction counts as read-only (no interaction)
  if (isOwnPost) {
    const totalReactions = Object.values(counts).reduce((a, b) => a + b, 0);
    return (
      <div className="space-y-2">
        {totalReactions > 0 ? (
          <div className="flex flex-wrap gap-2">
            {EMOJIS.filter((e) => (counts[e] ?? 0) > 0).map((emoji) => (
              <span
                key={emoji}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-white/[0.08] bg-white/[0.03] text-gray-600"
              >
                <span className="text-base">{emoji}</span>
                <span className="font-mono text-xs tabular-nums">{counts[emoji]}</span>
              </span>
            ))}
          </div>
        ) : null}
        <p className="text-xs text-gray-700">Reactions are from other members</p>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {EMOJIS.map((emoji) => {
        const count = counts[emoji] ?? 0;
        const active = myReactions.includes(emoji);
        return (
          <button
            key={emoji}
            onClick={() => handleToggle(emoji)}
            className={[
              "inline-flex items-center gap-1.5 px-3 py-1.5 text-sm transition-all duration-150 border",
              active
                ? "border-[rgba(59,232,255,0.55)] bg-[rgba(59,232,255,0.12)] text-[#9dfff4]"
                : "border-white/[0.08] bg-white/[0.03] text-gray-500 hover:border-white/20 hover:text-gray-300",
            ].join(" ")}
          >
            <span className="text-base">{emoji}</span>
            {count > 0 && (
              <span className="font-mono text-xs tabular-nums">{count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
