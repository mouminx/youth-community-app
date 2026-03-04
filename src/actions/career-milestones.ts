"use server";

import { getSupabaseServerClient } from "@/lib/supabaseServer";

export type CareerMilestone = {
  id: string;
  level_required: number;
  name: string;
  description: string;
  icon: string;
};

export type CareerMilestoneWithStatus = CareerMilestone & {
  earned: boolean;
  earned_at: string | null;
};

export type NewCareerAward = {
  id: string;
  level_required: number;
  name: string;
  icon: string;
};

// ── Called after claiming XP ───────────────────────────────────
// Awards any newly eligible milestones and returns them.
export async function checkCareerMilestones(): Promise<{
  careerLevel: number;
  newAwards: NewCareerAward[];
}> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.rpc("check_career_milestones");
  if (error || !data) return { careerLevel: 1, newAwards: [] };
  const d = data as { career_level: number; new_awards: NewCareerAward[] };
  return {
    careerLevel: d.career_level ?? 1,
    newAwards: d.new_awards ?? [],
  };
}

// ── Fetch all milestones with earned status for a given user ───
// Used on the profile page to show the full milestone grid.
export async function getCareerMilestonesWithStatus(
  userId: string
): Promise<CareerMilestoneWithStatus[]> {
  const supabase = await getSupabaseServerClient();
  const [milestonesRes, awardsRes] = await Promise.all([
    supabase
      .from("career_milestones")
      .select("id, level_required, name, description, icon")
      .order("level_required"),
    supabase
      .from("career_milestone_awards")
      .select("milestone_id, awarded_at")
      .eq("user_id", userId),
  ]);

  const earnedMap = new Map(
    (awardsRes.data ?? []).map((a) => [a.milestone_id, a.awarded_at])
  );

  return (milestonesRes.data ?? []).map((m) => ({
    id: m.id,
    level_required: m.level_required,
    name: m.name,
    description: m.description,
    icon: m.icon,
    earned: earnedMap.has(m.id),
    earned_at: earnedMap.get(m.id) ?? null,
  }));
}
