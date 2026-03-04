"use server";

import { getSupabaseServerClient } from "@/lib/supabaseServer";

export type UnreadCounts = {
  channels: Record<string, number>; // channel_id → unread message count
  feed: number;                      // unread post count
  hasPendingXp: boolean;
};

// ── Get all unread counts for a community ────────────────────────────────────
export async function getUnreadCounts(communityId: string): Promise<UnreadCounts> {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { channels: {}, feed: 0, hasPendingXp: false };

  // Run all three queries in parallel
  const [channelResult, feedResult, xpResult] = await Promise.all([
    // Unread messages per channel (not sent by current user, after last_read_at)
    supabase.rpc("get_channel_unread_counts", {
      _community_id: communityId,
      _user_id: user.id,
    }),
    // Unread posts (not by current user, after last_read_at)
    supabase.rpc("get_feed_unread_count", {
      _community_id: communityId,
      _user_id: user.id,
    }),
    // Pending XP
    supabase
      .from("pending_xp")
      .select("id", { count: "exact", head: true })
      .eq("community_id", communityId)
      .eq("user_id", user.id),
  ]);

  // Build channel unread map
  const channels: Record<string, number> = {};
  for (const row of channelResult.data ?? []) {
    channels[row.channel_id] = row.unread_count;
  }

  const feed = (feedResult.data as number | null) ?? 0;
  const hasPendingXp = (xpResult.count ?? 0) > 0;

  return { channels, feed, hasPendingXp };
}

// ── Mark a context as read ───────────────────────────────────────────────────
// contextKey: 'feed' | 'channel:{channelId}'
export async function markAsRead(communityId: string, contextKey: string) {
  const supabase = await getSupabaseServerClient();
  await supabase.rpc("mark_as_read", {
    _community_id: communityId,
    _context_key: contextKey,
  });
}
