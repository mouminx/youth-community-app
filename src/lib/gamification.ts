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

// Current climb level = number of tiers unlocked (0 if none).
export function getCurrentClimbLevel(xpTotal: number, tiers: Tier[]): number {
  return tiers.filter((t) => xpTotal >= t.xp_required).length;
}

// XP bar progress between the current tier threshold and the next tier threshold.
// Returns 0–100.
export function getClimbLevelBarPercent(xpTotal: number, tiers: Tier[]): number {
  if (tiers.length === 0) return 0;
  const sorted = [...tiers].sort((a, b) => a.xp_required - b.xp_required);
  const next = sorted.find((t) => xpTotal < t.xp_required);
  if (!next) return 100;
  const prev = [...sorted].reverse().find((t) => xpTotal >= t.xp_required);
  const fromXp = prev?.xp_required ?? 0;
  return Math.min(100, Math.max(0, ((xpTotal - fromXp) / (next.xp_required - fromXp)) * 100));
}

// ── Career Level (progressive scaling) ───────────────────────────────────────
// XP needed to reach level n: round(90 × (n−1)^1.8)
// Level 1 always starts at 0. Early levels come quickly; high levels require
// sustained long-term participation (level 50 ≈ 4 years at 500 XP/week).

function cumulativeXpForCareerLevel(n: number): number {
  if (n <= 1) return 0;
  return Math.round(90 * Math.pow(n - 1, 1.8));
}

export function getCareerLevel(totalXp: number): number {
  let level = 1;
  while (cumulativeXpForCareerLevel(level + 1) <= totalXp) level++;
  return level;
}

export function getCareerLevelProgress(totalXp: number): {
  level: number;
  xpInLevel: number;
  xpPerLevel: number;
  percent: number;
  xpToNext: number;
} {
  const level = getCareerLevel(totalXp);
  const xpAtCurrent = cumulativeXpForCareerLevel(level);
  const xpAtNext = cumulativeXpForCareerLevel(level + 1);
  const xpInLevel = totalXp - xpAtCurrent;
  const xpPerLevel = xpAtNext - xpAtCurrent;
  const percent = xpPerLevel > 0 ? (xpInLevel / xpPerLevel) * 100 : 100;
  const xpToNext = xpPerLevel - xpInLevel;
  return { level, xpInLevel, xpPerLevel, percent, xpToNext };
}

// ── Rank title (career levels 20+) ───────────────────────────────────────────

const ROMAN = ["I", "II", "III", "IV", "V"] as const;
export type RomanNumeral = (typeof ROMAN)[number];

export function toRoman(n: number): RomanNumeral {
  return ROMAN[n - 1];
}

const RANK_FAMILIES = [
  { start: 20, name: "Learner" },
  { start: 25, name: "Builder" },
  { start: 30, name: "Achiever" },
  { start: 35, name: "Proven" },
  { start: 40, name: "Premier" },
  { start: 45, name: "Elite" },
] as const;

/**
 * Returns the rank title for a career level.
 * - Level 50   → "Ascendant"
 * - Level 20–49 → "{Family} {Roman numeral within family}"
 * - Level < 20  → "" (no title)
 */
export function getRankTitle(level: number): string {
  if (level >= 50) return "Ascendant";
  for (let i = RANK_FAMILIES.length - 1; i >= 0; i--) {
    const { start, name } = RANK_FAMILIES[i];
    if (level >= start) {
      return `${name} ${toRoman(level - start + 1)}`;
    }
  }
  return "";
}

