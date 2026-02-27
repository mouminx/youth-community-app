// Pure function: given XP total and ordered tiers, compute which are unlocked.
export type Tier = {
  id: string;
  tier_number: number;
  xp_required: number;
  reward_label: string;
};

export function computeUnlockedTiers(xpTotal: number, tiers: Tier[]) {
  return tiers.map((tier) => ({
    ...tier,
    unlocked: xpTotal >= tier.xp_required,
  }));
}

// Find the next tier the user hasn't unlocked yet.
export function getNextTier(xpTotal: number, tiers: Tier[]): Tier | null {
  const sorted = [...tiers].sort((a, b) => a.xp_required - b.xp_required);
  return sorted.find((t) => xpTotal < t.xp_required) ?? null;
}
