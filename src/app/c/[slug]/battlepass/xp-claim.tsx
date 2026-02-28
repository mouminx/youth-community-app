"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { claimPendingXp, type PendingXpItem } from "@/actions/xp";
import { computeUnlockedTiers, getNextTier, type Tier } from "@/lib/gamification";

// ── helpers ────────────────────────────────────────────────────────────────────

function easeOutExpo(t: number) {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

function animateValue(
  from: number,
  to: number,
  duration: number,
  onUpdate: (v: number) => void,
  onDone: () => void
) {
  const start = performance.now();
  function tick(now: number) {
    const p = Math.min((now - start) / duration, 1);
    onUpdate(Math.round(from + (to - from) * easeOutExpo(p)));
    if (p < 1) requestAnimationFrame(tick);
    else onDone();
  }
  requestAnimationFrame(tick);
}

// Bar fill % relative to next tier (or 100 if maxed)
function toBarPercent(xp: number, tiers: Tier[]) {
  if (tiers.length === 0) return 0;
  const sorted = [...tiers].sort((a, b) => a.xp_required - b.xp_required);
  const next = sorted.find((t) => xp < t.xp_required);
  if (!next) return 100;
  const prev = [...sorted].reverse().find((t) => t.xp_required <= xp);
  const base = prev?.xp_required ?? 0;
  return Math.min(100, ((xp - base) / (next.xp_required - base)) * 100);
}

const REASON_LABEL: Record<string, string> = {
  attendance: "Event attendance",
  badge_award: "Badge awarded",
  manual: "Bonus XP",
};
const REASON_ICON: Record<string, string> = {
  attendance: "📍",
  badge_award: "🏅",
  manual: "⭐",
};

// ── types ──────────────────────────────────────────────────────────────────────

interface Props {
  communityId: string;
  initialXp: number;
  pendingItems: PendingXpItem[];
  tiers: Tier[];
  season: { name: string; starts_at: string; ends_at: string };
}

type Phase = "idle" | "claiming" | "animating" | "done";

interface FloatLabel {
  id: number;
  amount: number;
  left: number; // %
}

// ── component ──────────────────────────────────────────────────────────────────

export function XpClaimSection({ communityId, initialXp, pendingItems, tiers, season }: Props) {
  const router = useRouter();
  const pendingTotal = pendingItems.reduce((s, r) => s + r.amount, 0);
  const hasPending = pendingTotal > 0;

  const [phase, setPhase] = useState<Phase>("idle");
  const [displayXp, setDisplayXp] = useState(initialXp);
  const [barPercent, setBarPercent] = useState(0);
  const [newlyUnlocked, setNewlyUnlocked] = useState<Set<string>>(new Set());
  const [floats, setFloats] = useState<FloatLabel[]>([]);
  const [claimed, setClaimed] = useState(false);

  // Start bar at 0 then animate in on mount for the entry effect
  useEffect(() => {
    const t = setTimeout(() => setBarPercent(toBarPercent(initialXp, tiers)), 120);
    return () => clearTimeout(t);
  }, []);

  const tiersWithStatus = computeUnlockedTiers(displayXp, tiers);
  const nextTier = getNextTier(displayXp, tiers);
  const unlockedCount = tiersWithStatus.filter((t) => t.unlocked).length;

  async function handleClaim() {
    if (phase !== "idle" || claimed) return;
    setPhase("claiming");

    const result = await claimPendingXp(communityId);
    if ("error" in result) {
      setPhase("idle");
      return;
    }

    const targetXp = initialXp + pendingTotal;
    setPhase("animating");

    // Spawn floating "+XP" labels near the bar tip
    setFloats(
      pendingItems.slice(0, 4).map((item, i) => ({
        id: Date.now() + i,
        amount: item.amount,
        left: Math.min(95, toBarPercent(initialXp, tiers) + i * 3),
      }))
    );

    animateValue(
      initialXp,
      targetXp,
      1800,
      (v) => {
        setDisplayXp(v);
        setBarPercent(toBarPercent(v, tiers));
        // Detect tier unlocks mid-animation
        tiers.forEach((tier) => {
          if (v >= tier.xp_required && initialXp < tier.xp_required) {
            setNewlyUnlocked((prev) => new Set([...prev, tier.id]));
          }
        });
      },
      () => {
        setPhase("done");
        setClaimed(true);
        setTimeout(() => {
          setFloats([]);
          router.refresh();
        }, 600);
      }
    );
  }

  return (
    <div className="space-y-6">
      {/* ── XP Progress Card ──────────────────────────────────────────────── */}
      <div className="card relative overflow-visible px-6 py-5">
        {/* Ambient glow behind card */}
        <div className="pointer-events-none absolute inset-0 -z-10 rounded-xl bg-gradient-to-br from-violet-500/10 via-indigo-500/5 to-transparent blur-xl" />

        {/* Row: season label + tier count */}
        <div className="mb-1 flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-600">
            {season.name}
          </p>
          <p className="text-xs text-gray-600">
            {unlockedCount}/{tiersWithStatus.length} tiers
          </p>
        </div>

        {/* XP number */}
        <div className="mt-1 mb-5 flex items-baseline justify-between">
          <div className="flex items-baseline gap-2">
            <span
              className={`text-5xl font-extrabold tracking-tight tabular-nums transition-colors duration-300 ${
                phase === "animating" ? "text-violet-300" : "text-white"
              }`}
            >
              {displayXp.toLocaleString()}
            </span>
            <span className="text-xl font-semibold text-gray-600">XP</span>
            {hasPending && !claimed && (
              <span className="animate-pulse rounded-full bg-violet-500/20 px-2 py-0.5 text-xs font-bold text-violet-300 ring-1 ring-violet-500/30">
                +{pendingTotal} pending
              </span>
            )}
          </div>
          <div className="text-right">
            {nextTier ? (
              <>
                <p className="text-sm text-gray-500">
                  {(nextTier.xp_required - displayXp).toLocaleString()} XP to go
                </p>
                <p className="text-xs text-gray-700">Tier {nextTier.tier_number} · {nextTier.reward_label}</p>
              </>
            ) : (
              <p className="text-sm font-semibold text-emerald-400">Max tier reached! 🏆</p>
            )}
          </div>
        </div>

        {/* XP Bar */}
        <div className="relative">
          {/* Track */}
          <div className="relative h-4 overflow-hidden rounded-full bg-white/[0.05]">
            {/* Fill */}
            <div className="xp-bar-fill absolute inset-y-0 left-0" style={{ width: `${barPercent}%` }} />
          </div>

          {/* Glowing tip dot (outside the overflow-hidden track) */}
          {barPercent > 1 && barPercent < 100 && (
            <div
              className="xp-bar-tip pointer-events-none absolute top-1/2"
              style={{ left: `${barPercent}%` }}
            />
          )}

          {/* Floating +XP labels */}
          {floats.map((f) => (
            <div
              key={f.id}
              className="xp-float pointer-events-none absolute -top-1"
              style={{ left: `${f.left}%` }}
            >
              +{f.amount}
            </div>
          ))}
        </div>

        {/* Bar labels */}
        {nextTier && (
          <div className="mt-2 flex justify-between text-[10px] text-gray-700">
            <span>
              {tiersWithStatus.filter((t) => t.unlocked).slice(-1)[0]?.reward_label ?? "Start"}
            </span>
            <span className="font-medium text-gray-600">{Math.round(barPercent)}%</span>
            <span>{nextTier.reward_label}</span>
          </div>
        )}
      </div>

      {/* ── Claim Card ──────────────────────────────────────────────────────── */}
      {hasPending && !claimed && (
        <div className="xp-claim-card rounded-xl p-px">
          <div className="relative rounded-[11px] bg-[#0f0f1a] px-6 py-5">
            {/* Header */}
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/20 text-lg">
                ✨
              </div>
              <div>
                <p className="font-bold text-white">XP Ready to Claim</p>
                <p className="text-xs text-gray-500">Tap to collect your rewards</p>
              </div>
              <span className="ml-auto rounded-full bg-violet-500/20 px-3 py-1 text-sm font-extrabold text-violet-300 ring-1 ring-violet-500/30">
                +{pendingTotal} XP
              </span>
            </div>

            {/* Breakdown */}
            <div className="mb-5 space-y-2">
              {pendingItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-lg bg-white/[0.04] px-4 py-2.5"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-base">{REASON_ICON[item.reason] ?? "⭐"}</span>
                    <span className="text-sm text-gray-300">{REASON_LABEL[item.reason] ?? item.reason}</span>
                  </div>
                  <span className="text-sm font-bold text-violet-300">+{item.amount} XP</span>
                </div>
              ))}
            </div>

            {/* Claim button */}
            <button
              onClick={handleClaim}
              disabled={phase === "claiming" || phase === "animating"}
              className="xp-claim-btn relative w-full overflow-hidden rounded-xl py-3.5 text-sm font-extrabold uppercase tracking-[0.12em] text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {phase === "claiming" || phase === "animating" ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Collecting...
                </span>
              ) : (
                `Claim ${pendingTotal} XP`
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── Claimed success ──────────────────────────────────────────────────── */}
      {claimed && phase === "done" && (
        <div className="flex items-center gap-4 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.07] px-5 py-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20">
            <svg className="h-5 w-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-white">+{pendingTotal} XP collected!</p>
            <p className="text-xs text-gray-500">Keep showing up to earn more.</p>
          </div>
        </div>
      )}

      {/* ── Tiers List ───────────────────────────────────────────────────────── */}
      {tiersWithStatus.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 py-10 text-center">
          <p className="text-sm text-gray-600">No tiers configured for this season yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tiersWithStatus.map((tier) => {
            const isNew = newlyUnlocked.has(tier.id);
            return (
              <div
                key={tier.id}
                className={`tier-row flex items-center gap-4 rounded-xl border px-5 py-4 transition-all duration-500 ${
                  isNew
                    ? "tier-newly-unlocked border-yellow-500/40 bg-yellow-500/[0.08]"
                    : tier.unlocked
                    ? "border-emerald-500/20 bg-emerald-500/[0.05]"
                    : "border-white/[0.07] bg-[#111119] opacity-50"
                }`}
              >
                {/* Icon */}
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg ${
                    isNew
                      ? "bg-yellow-500/20"
                      : tier.unlocked
                      ? "bg-emerald-500/15"
                      : "bg-white/[0.04]"
                  }`}
                >
                  {isNew ? "🎉" : tier.unlocked ? "✅" : "🔒"}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white">
                    Tier {tier.tier_number}
                    {tier.reward_label && (
                      <span className="ml-2 font-normal text-gray-500">· {tier.reward_label}</span>
                    )}
                  </p>
                  <p className="text-xs text-gray-600">{tier.xp_required.toLocaleString()} XP required</p>
                </div>

                {/* Badge */}
                {isNew ? (
                  <span className="rounded-full bg-yellow-500/20 px-3 py-0.5 text-xs font-bold text-yellow-300 ring-1 ring-yellow-500/30">
                    Just unlocked!
                  </span>
                ) : tier.unlocked ? (
                  <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
                    Unlocked
                  </span>
                ) : (
                  <span className="rounded-full bg-white/[0.05] px-2.5 py-0.5 text-xs font-medium text-gray-600">
                    Locked
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
