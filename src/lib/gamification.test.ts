import { describe, it, expect } from "vitest";
import { toRoman, getRankTitle, getCareerLevel, getCareerLevelProgress } from "./gamification";

describe("toRoman", () => {
  it("converts 1–5 correctly", () => {
    expect(toRoman(1)).toBe("I");
    expect(toRoman(2)).toBe("II");
    expect(toRoman(3)).toBe("III");
    expect(toRoman(4)).toBe("IV");
    expect(toRoman(5)).toBe("V");
  });
});

describe("getRankTitle", () => {
  // ── Below rank threshold ──────────────────────────────────────────────────
  it("returns empty string for level 1", () => {
    expect(getRankTitle(1)).toBe("");
  });
  it("returns empty string for level 19", () => {
    expect(getRankTitle(19)).toBe("");
  });

  // ── Learner (20–24) ───────────────────────────────────────────────────────
  it("level 20 → Learner I", () => {
    expect(getRankTitle(20)).toBe("Learner I");
  });
  it("level 24 → Learner V", () => {
    expect(getRankTitle(24)).toBe("Learner V");
  });

  // ── Builder (25–29) ───────────────────────────────────────────────────────
  it("level 25 → Builder I", () => {
    expect(getRankTitle(25)).toBe("Builder I");
  });
  it("level 29 → Builder V", () => {
    expect(getRankTitle(29)).toBe("Builder V");
  });

  // ── Achiever (30–34) ─────────────────────────────────────────────────────
  it("level 30 → Achiever I", () => {
    expect(getRankTitle(30)).toBe("Achiever I");
  });
  it("level 34 → Achiever V", () => {
    expect(getRankTitle(34)).toBe("Achiever V");
  });

  // ── Proven (35–39) ───────────────────────────────────────────────────────
  it("level 35 → Proven I", () => {
    expect(getRankTitle(35)).toBe("Proven I");
  });
  it("level 39 → Proven V", () => {
    expect(getRankTitle(39)).toBe("Proven V");
  });

  // ── Premier (40–44) ──────────────────────────────────────────────────────
  it("level 40 → Premier I", () => {
    expect(getRankTitle(40)).toBe("Premier I");
  });
  it("level 44 → Premier V", () => {
    expect(getRankTitle(44)).toBe("Premier V");
  });

  // ── Elite (45–49) ────────────────────────────────────────────────────────
  it("level 45 → Elite I", () => {
    expect(getRankTitle(45)).toBe("Elite I");
  });
  it("level 49 → Elite V", () => {
    expect(getRankTitle(49)).toBe("Elite V");
  });

  // ── Ascendant (50) ───────────────────────────────────────────────────────
  it("level 50 → Ascendant", () => {
    expect(getRankTitle(50)).toBe("Ascendant");
  });
  it("level 51+ → Ascendant (cap)", () => {
    expect(getRankTitle(51)).toBe("Ascendant");
    expect(getRankTitle(99)).toBe("Ascendant");
  });
});

// ── getCareerLevel (progressive scaling: round(90 × (n−1)^1.8)) ─────────────
// Key thresholds: L1=0, L2=90, L5=1091, L10=4698, L20=18030, L30=38597, L50=99219
describe("getCareerLevel", () => {
  it("0 XP → level 1", () => {
    expect(getCareerLevel(0)).toBe(1);
  });
  it("89 XP → still level 1 (just below L2 threshold of 90)", () => {
    expect(getCareerLevel(89)).toBe(1);
  });
  it("90 XP → level 2 (exactly at L2 threshold)", () => {
    expect(getCareerLevel(90)).toBe(2);
  });
  it("500 XP → level 3 (first week at 500 XP/wk reaches L3)", () => {
    expect(getCareerLevel(500)).toBe(3);
  });
  it("1090 XP → level 4 (just below L5 threshold of 1091)", () => {
    expect(getCareerLevel(1090)).toBe(4);
  });
  it("1091 XP → level 5 (exactly at L5 threshold)", () => {
    expect(getCareerLevel(1091)).toBe(5);
  });
  it("4697 XP → level 9 (just below L10 threshold of 4698)", () => {
    expect(getCareerLevel(4697)).toBe(9);
  });
  it("4698 XP → level 10 (exactly at L10 threshold)", () => {
    expect(getCareerLevel(4698)).toBe(10);
  });
  it("18029 XP → level 19 (just below L20 threshold of 18030)", () => {
    expect(getCareerLevel(18029)).toBe(19);
  });
  it("18030 XP → level 20 / Learner I (exactly at L20 threshold)", () => {
    expect(getCareerLevel(18030)).toBe(20);
  });
  it("38596 XP → level 29 (just below L30 threshold of 38597)", () => {
    expect(getCareerLevel(38596)).toBe(29);
  });
  it("38597 XP → level 30 / Achiever I (exactly at L30 threshold)", () => {
    expect(getCareerLevel(38597)).toBe(30);
  });
  it("99218 XP → level 49 (just below Ascendant threshold of 99219)", () => {
    expect(getCareerLevel(99218)).toBe(49);
  });
  it("99219 XP → level 50 / Ascendant (exactly at L50 threshold)", () => {
    expect(getCareerLevel(99219)).toBe(50);
  });
  it("XP well beyond L50 stays at or above 50", () => {
    expect(getCareerLevel(999999)).toBeGreaterThanOrEqual(50);
  });
});

describe("getCareerLevelProgress", () => {
  it("at exactly a level threshold: xpInLevel=0, percent=0", () => {
    const p = getCareerLevelProgress(4698); // exactly L10
    expect(p.level).toBe(10);
    expect(p.xpInLevel).toBe(0);
    expect(p.percent).toBe(0);
  });
  it("midway through a level: percent is between 0 and 100", () => {
    // L10 threshold = 4698, L11 threshold = round(90 * 10^1.8) ≈ 5688
    // midpoint ≈ 4698 + (5688-4698)/2 ≈ 5193
    const p = getCareerLevelProgress(5193);
    expect(p.level).toBe(10);
    expect(p.percent).toBeGreaterThan(0);
    expect(p.percent).toBeLessThan(100);
    expect(p.xpToNext).toBeGreaterThan(0);
  });
});
