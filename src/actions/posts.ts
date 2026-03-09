"use server";

import { getSupabaseServerClient } from "@/lib/supabaseServer";

export type Post = {
  id: string;
  community_id: string;
  author_id: string;
  author_name: string;
  title: string;
  body: string;
  created_at: string;
  reaction_counts: Record<string, number>; // emoji → count
  my_reactions: string[]; // emojis current user has reacted with
};

export type Comment = {
  id: string;
  post_id: string;
  author_id: string;
  author_name: string;
  body: string;
  parent_id: string | null;
  created_at: string;
};

// ── Create a post ────────────────────────────────────────────────────────────
export async function createPost(communityId: string, title: string, body: string) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data, error } = await supabase
    .from("posts")
    .insert({ community_id: communityId, author_id: user.id, title: title.trim(), body: body.trim() })
    .select("id")
    .single();

  if (error) return { error: error.message };

  // Award XP based on meaningful word count (security-definer RPC)
  await supabase.rpc("award_post_creation_xp", { _post_id: data.id });

  return { data };
}

// ── Name resolution ──────────────────────────────────────────────────────────
function resolveDisplayName(
  profile: { username?: string | null; first_name?: string; last_name?: string; display_name?: string } | null,
  mode: string
): string {
  if (!profile) return "Member";
  switch (mode) {
    case "full_name":
      return `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() || profile.display_name || "Member";
    case "first_last_initial": {
      const initial = profile.last_name?.[0] ?? "";
      return `${profile.first_name ?? ""}${initial ? ` ${initial}.` : ""}`.trim() || "Member";
    }
    case "custom":
      return profile.display_name || profile.username || "Member";
    default:
      return profile.username ? `@${profile.username}` : (profile.display_name || "Member");
  }
}

// ── List posts for a community ───────────────────────────────────────────────
export async function listPosts(communityId: string, displayMode = "username"): Promise<Post[]> {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: posts } = await supabase
    .from("posts")
    .select("id, community_id, author_id, title, body, created_at, profiles:profiles(display_name, username, first_name, last_name)")
    .eq("community_id", communityId)
    .order("created_at", { ascending: false });

  if (!posts || posts.length === 0) return [];

  const postIds = posts.map((p) => p.id);

  // Fetch all reactions for these posts
  const { data: reactions } = await supabase
    .from("post_reactions")
    .select("post_id, user_id, emoji")
    .in("post_id", postIds);

  const reactionsByPost = new Map<string, { emoji: string; user_id: string }[]>();
  for (const r of reactions ?? []) {
    if (!reactionsByPost.has(r.post_id)) reactionsByPost.set(r.post_id, []);
    reactionsByPost.get(r.post_id)!.push({ emoji: r.emoji, user_id: r.user_id });
  }

  return posts.map((p: any) => {
    const postReactions = reactionsByPost.get(p.id) ?? [];
    const reaction_counts: Record<string, number> = {};
    const my_reactions: string[] = [];

    for (const r of postReactions) {
      reaction_counts[r.emoji] = (reaction_counts[r.emoji] ?? 0) + 1;
      if (r.user_id === user?.id) my_reactions.push(r.emoji);
    }

    const profile = Array.isArray(p.profiles) ? p.profiles[0] : p.profiles;

    return {
      id: p.id,
      community_id: p.community_id,
      author_id: p.author_id,
      author_name: resolveDisplayName(profile, displayMode),
      title: p.title,
      body: p.body,
      created_at: p.created_at,
      reaction_counts,
      my_reactions,
    };
  });
}

// ── Get a single post ────────────────────────────────────────────────────────
export async function getPost(postId: string, displayMode = "username"): Promise<Post | null> {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: p } = await supabase
    .from("posts")
    .select("id, community_id, author_id, title, body, created_at, profiles:profiles(display_name, username, first_name, last_name)")
    .eq("id", postId)
    .single();

  if (!p) return null;

  const { data: reactions } = await supabase
    .from("post_reactions")
    .select("user_id, emoji")
    .eq("post_id", postId);

  const reaction_counts: Record<string, number> = {};
  const my_reactions: string[] = [];
  for (const r of reactions ?? []) {
    reaction_counts[r.emoji] = (reaction_counts[r.emoji] ?? 0) + 1;
    if (r.user_id === user?.id) my_reactions.push(r.emoji);
  }

  const profile = Array.isArray((p as any).profiles) ? (p as any).profiles[0] : (p as any).profiles;

  return {
    id: p.id,
    community_id: p.community_id,
    author_id: p.author_id,
    author_name: resolveDisplayName(profile, displayMode),
    title: p.title,
    body: p.body,
    created_at: p.created_at,
    reaction_counts,
    my_reactions,
  };
}

// ── Toggle a reaction ────────────────────────────────────────────────────────
export async function toggleReaction(postId: string, emoji: string) {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.rpc("toggle_post_reaction", {
    _post_id: postId,
    _emoji: emoji,
  });
  if (error) return { error: error.message };
  return { data: data as { action: "added" | "removed" | "not_allowed" } };
}

// ── Create a comment ─────────────────────────────────────────────────────────
export async function createComment(postId: string, body: string, parentId?: string) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Get community_id from the post
  const { data: post } = await supabase
    .from("posts")
    .select("community_id")
    .eq("id", postId)
    .single();
  if (!post) return { error: "Post not found" };

  const { data, error } = await supabase
    .from("post_comments")
    .insert({
      post_id: postId,
      community_id: post.community_id,
      author_id: user.id,
      body: body.trim(),
      parent_id: parentId ?? null,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  return { data };
}

// ── List comments for a post ─────────────────────────────────────────────────
export async function listComments(postId: string, displayMode = "username"): Promise<Comment[]> {
  const supabase = await getSupabaseServerClient();

  const { data } = await supabase
    .from("post_comments")
    .select("id, post_id, author_id, body, parent_id, created_at, profiles:profiles(display_name, username, first_name, last_name)")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });

  return (data ?? []).map((c: any) => {
    const profile = Array.isArray(c.profiles) ? c.profiles[0] : c.profiles;
    return {
      id: c.id,
      post_id: c.post_id,
      author_id: c.author_id,
      author_name: resolveDisplayName(profile, displayMode),
      body: c.body,
      parent_id: c.parent_id ?? null,
      created_at: c.created_at,
    };
  });
}
