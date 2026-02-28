"use server";

import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { requireRole } from "@/lib/rbac";

// ── Mark attendance for multiple users (mentor+) ───────────────
// Prevents double-dipping: skips users who already have attendance for this event.
export async function markAttendance(eventId: string, userIds: string[]) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Get the event to know the community.
  const { data: event, error: eventErr } = await supabase
    .from("events")
    .select("id, community_id")
    .eq("id", eventId)
    .single();
  if (eventErr || !event) return { error: "Event not found" };

  await requireRole(supabase, event.community_id, user.id, "mentor");

  // Find who already has attendance for this event to prevent double XP.
  const { data: existing } = await supabase
    .from("event_attendance")
    .select("user_id")
    .eq("event_id", eventId)
    .in("user_id", userIds);

  const alreadyMarked = new Set(existing?.map((e) => e.user_id) ?? []);
  const newUserIds = userIds.filter((uid) => !alreadyMarked.has(uid));

  if (newUserIds.length === 0) {
    return { data: { marked: 0, skipped: userIds.length } };
  }

  // Find the active season (nullable).
  const { data: activeSeason } = await supabase
    .from("seasons")
    .select("id")
    .eq("community_id", event.community_id)
    .eq("is_active", true)
    .single();

  // Insert attendance rows.
  const attendanceRows = newUserIds.map((uid) => ({
    event_id: eventId,
    user_id: uid,
    marked_by: user.id,
  }));
  const { error: attendErr } = await supabase
    .from("event_attendance")
    .insert(attendanceRows);
  if (attendErr) return { error: attendErr.message };

  // Queue +50 XP in pending_xp — users claim it themselves for the dopamine hit.
  const xpRows = newUserIds.map((uid) => ({
    community_id: event.community_id,
    user_id: uid,
    season_id: activeSeason?.id ?? null,
    amount: 50,
    reason: "attendance" as const,
    reference_id: eventId,
  }));
  const { error: xpErr } = await supabase
    .from("pending_xp")
    .insert(xpRows);
  if (xpErr) return { error: xpErr.message };

  // Audit log.
  await supabase.from("audit_log").insert({
    community_id: event.community_id,
    actor_id: user.id,
    action: "attendance_marked",
    metadata: { event_id: eventId, user_ids: newUserIds },
  });

  return { data: { marked: newUserIds.length, skipped: alreadyMarked.size } };
}

// ── List members with RSVP + attendance status for an event ────
export async function listAttendeesForEvent(eventId: string) {
  const supabase = await getSupabaseServerClient();

  // Get event to know community.
  const { data: event } = await supabase
    .from("events")
    .select("community_id")
    .eq("id", eventId)
    .single();
  if (!event) return { error: "Event not found" };

  // Get all community members.
  const { data: members } = await supabase
    .from("memberships")
    .select("user_id, role, profiles:profiles(display_name, avatar_url)")
    .eq("community_id", event.community_id);

  // Get RSVPs for this event.
  const { data: rsvps } = await supabase
    .from("event_rsvps")
    .select("user_id")
    .eq("event_id", eventId);

  // Get attendance for this event.
  const { data: attendance } = await supabase
    .from("event_attendance")
    .select("user_id")
    .eq("event_id", eventId);

  const rsvpSet = new Set(rsvps?.map((r) => r.user_id) ?? []);
  const attendanceSet = new Set(attendance?.map((a) => a.user_id) ?? []);

  const result = (members ?? []).map((m: any) => ({
    user_id: m.user_id,
    role: m.role,
    display_name: m.profiles?.display_name ?? "",
    avatar_url: m.profiles?.avatar_url ?? "",
    has_rsvp: rsvpSet.has(m.user_id),
    attended: attendanceSet.has(m.user_id),
  }));

  // Sort: RSVP'd first, then by name.
  result.sort((a, b) => {
    if (a.has_rsvp !== b.has_rsvp) return a.has_rsvp ? -1 : 1;
    return a.display_name.localeCompare(b.display_name);
  });

  return { data: result };
}
