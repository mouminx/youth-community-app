"use server";

import { getSupabaseServerClient } from "@/lib/supabaseServer";
import {
  getMembership,
  meetsRole,
  requireRole,
  requirePermission,
  type GrantablePermission,
} from "@/lib/rbac";

// ── Permission Requests ────────────────────────────────────────────────────────

// Submit a permission request. Mentors can request grantable permissions;
// the request routes to admins. Admin requests route to owner.
export async function requestPermission(
  communityId: string,
  permission: GrantablePermission,
  note = ""
): Promise<{ data: { id: string } } | { error: string }> {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  try {
    await requireRole(supabase, communityId, user.id, "mentor");
  } catch {
    return { error: "Not a mentor or higher" };
  }

  // Already has the permission?
  const membership = await getMembership(supabase, communityId, user.id);
  if (!membership) return { error: "Not a member" };
  if (meetsRole(membership.role, "admin")) {
    return { error: "You already have this permission by role" };
  }
  const { data: existing } = await supabase
    .from("community_permissions")
    .select("id")
    .eq("community_id", communityId)
    .eq("user_id", user.id)
    .eq("permission", permission)
    .maybeSingle();
  if (existing) return { error: "Permission already granted" };

  // Duplicate pending request?
  const { data: pending } = await supabase
    .from("permission_requests")
    .select("id")
    .eq("community_id", communityId)
    .eq("requester_id", user.id)
    .eq("permission", permission)
    .eq("status", "pending")
    .maybeSingle();
  if (pending) return { error: "Request already pending" };

  const { data, error } = await supabase
    .from("permission_requests")
    .insert({
      community_id: communityId,
      requester_id: user.id,
      permission,
      requester_note: note,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  return { data: { id: data.id } };
}

// Approve or deny a permission request (admin+).
export async function reviewPermissionRequest(
  requestId: string,
  action: "approve" | "deny",
  reviewerNote = ""
): Promise<{ data: { success: true } } | { error: string }> {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Fetch the request.
  const { data: req, error: reqErr } = await supabase
    .from("permission_requests")
    .select("*")
    .eq("id", requestId)
    .single();
  if (reqErr || !req) return { error: "Request not found" };
  if (req.status !== "pending") return { error: "Request already reviewed" };

  // Must be admin+ in that community.
  try {
    await requireRole(supabase, req.community_id, user.id, "admin");
  } catch {
    return { error: "Requires admin role" };
  }

  // Update the request.
  const { error: updateErr } = await supabase
    .from("permission_requests")
    .update({
      status: action === "approve" ? "approved" : "denied",
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      reviewer_note: reviewerNote,
      updated_at: new Date().toISOString(),
    })
    .eq("id", requestId);
  if (updateErr) return { error: updateErr.message };

  // If approving, create the grant.
  if (action === "approve") {
    const { error: grantErr } = await supabase
      .from("community_permissions")
      .upsert(
        {
          community_id: req.community_id,
          user_id: req.requester_id,
          permission: req.permission,
          granted_by: user.id,
        },
        { onConflict: "community_id,user_id,permission", ignoreDuplicates: true }
      );
    if (grantErr) return { error: grantErr.message };
  }

  // Audit log.
  await supabase.from("audit_log").insert({
    community_id: req.community_id,
    actor_id: user.id,
    action:
      action === "approve"
        ? "permission_request_approved"
        : "permission_request_denied",
    target_user_id: req.requester_id,
    metadata: { permission: req.permission, request_id: requestId },
  });

  return { data: { success: true } };
}

// Revoke an explicit grant (admin+).
export async function revokePermission(
  communityId: string,
  targetUserId: string,
  permission: GrantablePermission
): Promise<{ data: { success: true } } | { error: string }> {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  try {
    await requireRole(supabase, communityId, user.id, "admin");
  } catch {
    return { error: "Requires admin role" };
  }

  const { error } = await supabase
    .from("community_permissions")
    .delete()
    .eq("community_id", communityId)
    .eq("user_id", targetUserId)
    .eq("permission", permission);
  if (error) return { error: error.message };

  await supabase.from("audit_log").insert({
    community_id: communityId,
    actor_id: user.id,
    action: "permission_revoked",
    target_user_id: targetUserId,
    metadata: { permission },
  });

  return { data: { success: true } };
}

// ── Member Management ──────────────────────────────────────────────────────────

// Change a member's role between member ↔ mentor.
// Admin+ can also use this to demote mentors; owner uses dedicated admin actions.
export async function changeMemberRole(
  communityId: string,
  targetUserId: string,
  newRole: "member" | "mentor"
): Promise<{ data: { success: true } } | { error: string }> {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  if (targetUserId === user.id) return { error: "Cannot change your own role" };

  try {
    await requirePermission(supabase, communityId, user.id, "manage_members");
  } catch {
    return { error: "Requires manage_members permission" };
  }

  // Verify target is not admin/owner (can't touch those without owner role).
  const targetMembership = await getMembership(supabase, communityId, targetUserId);
  if (!targetMembership) return { error: "User not found in this community" };
  if (meetsRole(targetMembership.role, "admin")) {
    return { error: "Cannot change an admin or owner's role here" };
  }

  const { error } = await supabase
    .from("memberships")
    .update({ role: newRole })
    .eq("community_id", communityId)
    .eq("user_id", targetUserId);
  if (error) return { error: error.message };

  await supabase.from("audit_log").insert({
    community_id: communityId,
    actor_id: user.id,
    action: "role_changed",
    target_user_id: targetUserId,
    metadata: { new_role: newRole, previous_role: targetMembership.role },
  });

  return { data: { success: true } };
}

// ── Admin Management (owner only) ─────────────────────────────────────────────

// Promote a mentor to admin (owner only).
export async function promoteToAdmin(
  communityId: string,
  targetUserId: string
): Promise<{ data: { success: true } } | { error: string }> {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  try {
    await requireRole(supabase, communityId, user.id, "owner");
  } catch {
    return { error: "Only the owner can promote to admin" };
  }

  const target = await getMembership(supabase, communityId, targetUserId);
  if (!target) return { error: "User not found" };
  if (target.role === "admin") return { error: "User is already an admin" };
  if (target.role === "owner") return { error: "Cannot change an owner's role" };

  const { error } = await supabase
    .from("memberships")
    .update({ role: "admin" })
    .eq("community_id", communityId)
    .eq("user_id", targetUserId);
  if (error) return { error: error.message };

  await supabase.from("audit_log").insert({
    community_id: communityId,
    actor_id: user.id,
    action: "admin_promoted",
    target_user_id: targetUserId,
    metadata: { previous_role: target.role },
  });

  return { data: { success: true } };
}

// Demote an admin to mentor (owner only). Also removes all their grants.
export async function demoteAdmin(
  communityId: string,
  targetUserId: string
): Promise<{ data: { success: true } } | { error: string }> {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  try {
    await requireRole(supabase, communityId, user.id, "owner");
  } catch {
    return { error: "Only the owner can demote admins" };
  }

  const target = await getMembership(supabase, communityId, targetUserId);
  if (!target) return { error: "User not found" };
  if (target.role !== "admin") return { error: "User is not an admin" };

  const { error } = await supabase
    .from("memberships")
    .update({ role: "mentor" })
    .eq("community_id", communityId)
    .eq("user_id", targetUserId);
  if (error) return { error: error.message };

  // Remove any explicit grants (they now need them re-granted as mentor).
  await supabase
    .from("community_permissions")
    .delete()
    .eq("community_id", communityId)
    .eq("user_id", targetUserId);

  await supabase.from("audit_log").insert({
    community_id: communityId,
    actor_id: user.id,
    action: "admin_demoted",
    target_user_id: targetUserId,
    metadata: {},
  });

  return { data: { success: true } };
}

// ── Channel Management ─────────────────────────────────────────────────────────

export async function createChannel(
  communityId: string,
  name: string
): Promise<{ data: { id: string; name: string } } | { error: string }> {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const trimmed = name.trim().toLowerCase().replace(/\s+/g, "-");
  if (!trimmed || trimmed.length > 40) return { error: "Channel name must be 1–40 characters" };

  try {
    await requirePermission(supabase, communityId, user.id, "manage_channels");
  } catch {
    return { error: "Requires manage_channels permission" };
  }

  const { data, error } = await supabase
    .from("channels")
    .insert({ community_id: communityId, name: trimmed })
    .select("id, name")
    .single();
  if (error) return { error: error.message };
  return { data };
}
