"use server";

import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { requireRole } from "@/lib/rbac";

function generateCode(length = 8): string {
  // Unambiguous characters (no 0/O, 1/I/l)
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

// ── createInviteCode ──────────────────────────────────────────────────────────
export async function createInviteCode(communityId: string, label?: string) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  try {
    await requireRole(supabase, communityId, user.id, "admin");
  } catch {
    return { error: "Admin or owner role required" };
  }

  // Retry on unlikely collision.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode();
    const { data, error } = await supabase
      .from("invite_codes")
      .insert({ community_id: communityId, code, label: label || null, created_by: user.id })
      .select("id, code")
      .single();

    if (!error) return { data };
    if (!error.message.includes("unique")) return { error: error.message };
  }

  return { error: "Failed to generate a unique code — please try again." };
}

// ── listInviteCodes ───────────────────────────────────────────────────────────
export async function listInviteCodes(communityId: string) {
  const supabase = await getSupabaseServerClient();
  const { data } = await supabase
    .from("invite_codes")
    .select("id, code, label, use_count, is_active, created_at")
    .eq("community_id", communityId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

// ── deactivateInviteCode ──────────────────────────────────────────────────────
export async function deactivateInviteCode(communityId: string, codeId: string) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  try {
    await requireRole(supabase, communityId, user.id, "admin");
  } catch {
    return { error: "Admin or owner role required" };
  }

  const { error } = await supabase
    .from("invite_codes")
    .update({ is_active: false })
    .eq("id", codeId)
    .eq("community_id", communityId);

  if (error) return { error: error.message };
  return { data: { success: true } };
}

// ── getInviteInfo ─────────────────────────────────────────────────────────────
// Callable by unauthenticated users — returns community info for a valid code.
export async function getInviteInfo(code: string) {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.rpc("get_invite_info", { _code: code });
  if (error) return { error: error.message };
  if (data?.error) return { error: data.error as string };
  return {
    data: data as {
      community_id: string;
      community_name: string;
      community_slug: string;
      community_description: string | null;
    },
  };
}

// ── useInviteCode ─────────────────────────────────────────────────────────────
// Requires authentication — joins the community and returns the slug for redirect.
export async function useInviteCode(code: string) {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.rpc("use_invite_code", { _code: code });
  if (error) return { error: error.message };
  if (data?.error) return { error: data.error as string };
  return {
    data: data as { community_slug: string; already_member: boolean },
  };
}
