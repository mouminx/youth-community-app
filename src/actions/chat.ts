"use server";

import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { requireRole } from "@/lib/rbac";

// ── List channels for a community ──────────────────────────────
export async function listChannels(communityId: string) {
  const supabase = await getSupabaseServerClient();
  const { data } = await supabase
    .from("channels")
    .select("id, name, read_only, created_at")
    .eq("community_id", communityId)
    .order("created_at", { ascending: true });
  return data ?? [];
}

// ── Post a message (member) ────────────────────────────────────
export async function postMessage(
  communityId: string,
  channelId: string,
  content: string
) {
  if (!content.trim()) return { error: "Message cannot be empty" };

  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data, error } = await supabase
    .from("messages")
    .insert({
      channel_id: channelId,
      community_id: communityId,
      user_id: user.id,
      content: content.trim(),
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  return { data };
}

// ── List messages for a channel ────────────────────────────────
export async function listMessages(
  communityId: string,
  channelId: string,
  limit = 50
) {
  const supabase = await getSupabaseServerClient();
  const { data } = await supabase
    .from("messages")
    .select("id, content, created_at, user_id, profiles:profiles(display_name, avatar_seed, avatar_bg)")
    .eq("community_id", communityId)
    .eq("channel_id", channelId)
    .order("created_at", { ascending: false })
    .limit(limit);

  // Normalize: Supabase may type the joined profiles as an array.
  // We flatten to a single object for the UI.
  const normalized = (data ?? []).map((row: any) => ({
    id: row.id,
    content: row.content,
    created_at: row.created_at,
    user_id: row.user_id,
    profiles: Array.isArray(row.profiles)
      ? row.profiles[0] ?? null
      : row.profiles,
  }));

  // Return in chronological order.
  return normalized.reverse();
}

// ── Delete a message (author or mentor+) ───────────────────────
export async function deleteMessage(messageId: string, communityId: string) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // RLS handles permission: author can delete own, mentor+ can delete any.
  const { error } = await supabase
    .from("messages")
    .delete()
    .eq("id", messageId)
    .eq("community_id", communityId);

  if (error) return { error: error.message };
  return { data: { success: true } };
}
