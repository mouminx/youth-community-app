"use server";

import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { getMembership } from "@/lib/rbac";
import { THEME_KEYS, type ThemeKey } from "@/lib/themes";

export type { ThemeKey };

export async function updateCommunityTheme(
  communityId: string,
  themeKey: ThemeKey
): Promise<{ error: string } | { success: true }> {
  if (!THEME_KEYS.includes(themeKey)) return { error: "Invalid theme" };

  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const membership = await getMembership(supabase, communityId, user.id);
  if (!membership || membership.role !== "owner") {
    return { error: "Only the community owner can change the theme" };
  }

  const { error } = await supabase
    .from("communities")
    .update({ theme_key: themeKey })
    .eq("id", communityId);

  if (error) return { error: error.message };
  return { success: true };
}
