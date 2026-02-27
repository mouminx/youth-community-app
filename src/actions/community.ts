"use server";

import { getSupabaseServerClient } from "@/lib/supabaseServer";

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;

export async function createCommunity(name: string, slug: string) {
  if (!name.trim()) return { error: "Name is required" };

  const normalizedSlug = slug.toLowerCase().trim();
  if (!SLUG_RE.test(normalizedSlug)) {
    return {
      error:
        "Slug must be 3–30 chars, lowercase letters/numbers/hyphens, no leading/trailing hyphen.",
    };
  }

  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Insert community row (RLS: created_by = auth.uid()).
  const { data: community, error: communityError } = await supabase
    .from("communities")
    .insert({ name: name.trim(), slug: normalizedSlug, created_by: user.id })
    .select("id, slug")
    .single();

  if (communityError) {
    if (communityError.code === "23505") {
      return { error: "That slug is already taken." };
    }
    return { error: communityError.message };
  }

  // Bootstrap: set creator as owner + create default channels.
  // Uses a security-definer RPC to bypass the 'member-only' insert policy.
  const { error: bootstrapError } = await supabase.rpc(
    "bootstrap_community",
    { _community_id: community.id, _user_id: user.id }
  );

  if (bootstrapError) {
    await supabase.from("communities").delete().eq("id", community.id);
    return { error: "Failed to initialize community: " + bootstrapError.message };
  }

  return { data: { slug: community.slug } };
}
