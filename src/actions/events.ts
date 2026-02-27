"use server";

import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { requireRole, getCommunityBySlug } from "@/lib/rbac";

// ── Create event (mentor+) ─────────────────────────────────────
export async function createEvent(
  communityId: string,
  payload: {
    title: string;
    description?: string;
    location?: string;
    start_time: string; // ISO string
    end_time?: string;
  }
) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  await requireRole(supabase, communityId, user.id, "mentor");

  const { data, error } = await supabase
    .from("events")
    .insert({
      community_id: communityId,
      title: payload.title,
      description: payload.description ?? "",
      location: payload.location ?? "",
      start_time: payload.start_time,
      end_time: payload.end_time ?? null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  return { data };
}

// ── Update event (mentor+) ─────────────────────────────────────
export async function updateEvent(
  eventId: string,
  communityId: string,
  payload: {
    title?: string;
    description?: string;
    location?: string;
    start_time?: string;
    end_time?: string;
  }
) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  await requireRole(supabase, communityId, user.id, "mentor");

  const { error } = await supabase
    .from("events")
    .update(payload)
    .eq("id", eventId)
    .eq("community_id", communityId);

  if (error) return { error: error.message };
  return { data: { success: true } };
}

// ── RSVP (member, self only) ───────────────────────────────────
export async function rsvpEvent(eventId: string, action: "rsvp" | "cancel") {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  if (action === "rsvp") {
    const { error } = await supabase
      .from("event_rsvps")
      .upsert(
        { event_id: eventId, user_id: user.id },
        { onConflict: "event_id,user_id" }
      );
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase
      .from("event_rsvps")
      .delete()
      .eq("event_id", eventId)
      .eq("user_id", user.id);
    if (error) return { error: error.message };
  }

  return { data: { success: true } };
}

// ── List events ────────────────────────────────────────────────
export async function listEvents(communityId: string) {
  const supabase = await getSupabaseServerClient();

  const now = new Date().toISOString();

  const [upcoming, past] = await Promise.all([
    supabase
      .from("events")
      .select("*, event_rsvps(user_id)")
      .eq("community_id", communityId)
      .gte("start_time", now)
      .order("start_time", { ascending: true })
      .limit(50),
    supabase
      .from("events")
      .select("*, event_rsvps(user_id)")
      .eq("community_id", communityId)
      .lt("start_time", now)
      .order("start_time", { ascending: false })
      .limit(20),
  ]);

  return {
    upcoming: upcoming.data ?? [],
    past: past.data ?? [],
  };
}

// ── Get single event ───────────────────────────────────────────
export async function getEvent(eventId: string) {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("events")
    .select("*, event_rsvps(user_id), event_attendance(user_id, marked_by)")
    .eq("id", eventId)
    .single();

  if (error) return { error: error.message };
  return { data };
}
