"use client";

import { useState, useEffect, useRef, useMemo, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { claimPendingXp, type PendingXpItem } from "@/actions/xp";
import { checkCareerMilestones, type NewCareerAward } from "@/actions/career-milestones";
import {
  computeUnlockedTiers,
  getCurrentClimbLevel,
  getClimbLevelBarPercent,
  getCareerLevelProgress,
  getCareerLevel,
  getNextTier,
  getRankTitle,
  type Tier,
} from "@/lib/gamification";

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

// ── icons ──────────────────────────────────────────────────────────────────────

function Trophy({ className = "" }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 21h8M12 17v4m-4-14h8m-8 0H5a1 1 0 00-1 1v1a4 4 0 004 4h0m8-6h3a1 1 0 011 1v1a4 4 0 01-4 4h0m-8 0a4 4 0 008 0V5a1 1 0 00-1-1h-6a1 1 0 00-1 1v8z" /></svg>;
}
function Sparkles({ className = "" }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 3l1.5 3.5L10 8 6.5 9.5 5 13 3.5 9.5 0 8l3.5-1.5L5 3zm14 4l1 2.5L22.5 10 20 11.5 19 14l-1-2.5L15.5 10 18 9.5 19 7zM12 10l2.4 5.6L20 18l-5.6 2.4L12 26l-2.4-5.6L4 18l5.6-2.4L12 10z" /></svg>;
}
function MapPin({ className = "" }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 21s7-5.8 7-11a7 7 0 10-14 0c0 5.2 7 11 7 11z" /><circle cx="12" cy="10" r="2.5" /></svg>;
}
function Medal({ className = "" }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 3h8l-1.5 5h-5L8 3zm4 7a6 6 0 110 12 6 6 0 010-12z" /></svg>;
}
function Star({ className = "" }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 3l2.7 5.5L21 9.4l-4.5 4.4L17.5 20 12 17l-5.5 3 1-6.2L3 9.4l6.3-.9L12 3z" /></svg>;
}
function CheckCircle2({ className = "" }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="9" /><path strokeLinecap="round" strokeLinejoin="round" d="M8.5 12.5l2.5 2.5 4.5-5" /></svg>;
}
function Lock({ className = "" }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="5" y="11" width="14" height="10" rx="2" /><path strokeLinecap="round" strokeLinejoin="round" d="M8 11V8a4 4 0 118 0v3" /></svg>;
}
function PartyPopper({ className = "" }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 19l8-8m0 0l6-6 1 1-6 6m-1-1l4 4M5 19l4 4 6-6-4-4-6 6z" /><path strokeLinecap="round" strokeLinejoin="round" d="M14 4l1-2m4 6l2-1M9 3l-1-2" /></svg>;
}

const REASON_LABEL: Record<string, string> = {
  attendance: "Event attendance",
  badge_award: "Badge awarded",
  manual: "Bonus XP",
};
const REASON_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  attendance: MapPin,
  badge_award: Medal,
  manual: Star,
};

// ── types ──────────────────────────────────────────────────────────────────────

interface LevelUpEvent {
  id: number;
  type: "ladder" | "career";
  fromLevel: number;
  toLevel: number;
}

interface Props {
  communityId: string;
  initialXp: number;
  initialCareerXp: number;
  initialCurrency: number;
  pendingItems: PendingXpItem[];
  tiers: Tier[];
  season: { name: string; starts_at: string; ends_at: string };
}

type Phase = "idle" | "claiming" | "animating" | "done";

interface FloatLabel {
  id: number;
  amount: number;
  left: number;
}

// ── LevelUpModal ───────────────────────────────────────────────────────────────

function LevelUpModal({ event, onDismiss }: { event: LevelUpEvent; onDismiss: () => void }) {
  const [phase, setPhase] = useState<"before" | "after">("before");
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("after"), 750);
    const t2 = setTimeout(() => dismissRef.current(), 3600);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  const label = event.type === "ladder" ? "Climb Level" : "Career Level";
  const color = event.type === "ladder" ? "var(--neon-lime)" : "var(--neon-cyan)";

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.78)", backdropFilter: "blur(6px)" }}
      onClick={onDismiss}
    >
      <div
        className="level-up-modal-card flex flex-col items-center gap-3 px-12 py-9"
        style={{
          background: "#0c0c16",
          border: `1px solid color-mix(in srgb, ${color} 33%, transparent)`,
          boxShadow: `0 0 0 1px color-mix(in srgb, ${color} 13%, transparent), 0 0 60px color-mix(in srgb, ${color} 10%, transparent), 0 8px 40px rgba(0,0,0,0.7)`,
          minWidth: "280px",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {phase === "before" ? (
          <>
            <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "#4b5563" }}>
              {label}
            </p>
            <span
              className="text-9xl font-extrabold tabular-nums leading-none"
              style={{ color: "#1f2937" }}
            >
              {event.fromLevel}
            </span>
          </>
        ) : (
          <>
            <p
              className="text-xs font-bold uppercase tracking-[0.2em] animate-pulse"
              style={{ color }}
            >
              ★ level up! ★
            </p>
            <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "#9ca3af" }}>
              {label}
            </p>
            <span
              key="after-number"
              className="level-up-number-pop text-9xl font-extrabold tabular-nums leading-none"
              style={{
                color,
                textShadow: `0 0 30px ${color}, 0 0 70px color-mix(in srgb, ${color} 50%, transparent), 0 0 120px color-mix(in srgb, ${color} 25%, transparent)`,
              }}
            >
              {event.toLevel}
            </span>
            <p className="text-[9px] text-gray-700 mt-1 uppercase tracking-widest">tap to dismiss</p>
          </>
        )}
      </div>
    </div>
  );
}

// ── component ──────────────────────────────────────────────────────────────────

export function XpClaimSection({ communityId, initialXp, initialCareerXp, initialCurrency, pendingItems, tiers, season }: Props) {
  const router = useRouter();
  const pendingTotal = pendingItems.reduce((s, r) => s + r.amount, 0);
  const hasPending = pendingTotal > 0;

  const [phase, setPhase] = useState<Phase>("idle");
  const [displayXp, setDisplayXp] = useState(initialXp);
  const [displayCareerXp, setDisplayCareerXp] = useState(initialCareerXp);
  const [displayCurrency, setDisplayCurrency] = useState(initialCurrency);
  const [barPercent, setBarPercent] = useState(0);
  const [newlyUnlocked, setNewlyUnlocked] = useState<Set<string>>(new Set());
  const [floats, setFloats] = useState<FloatLabel[]>([]);
  const [claimed, setClaimed] = useState(false);
  const [levelUpQueue, setLevelUpQueue] = useState<LevelUpEvent[]>([]);
  const [activeModal, setActiveModal] = useState<LevelUpEvent | null>(null);
  const [newMilestones, setNewMilestones] = useState<NewCareerAward[]>([]);
  const showParticles = phase === "claiming" || phase === "animating";
  const safePercent = Number.isFinite(barPercent) ? barPercent : 0;
  const fillWidth = safePercent <= 0 ? "0%" : `${Math.max(safePercent, 1.2)}%`;

  const particles = useMemo(
    () =>
      Array.from({ length: 64 }, (_, i) => ({
        id: i,
        left: `${Math.random() * 100}%`,
        delay: `${Math.random() * 0.9}s`,
        duration: `${0.8 + Math.random() * 1.45}s`,
        size: `${2 + Math.random() * 6}px`,
      })),
    []
  );

  // Animate bar in on mount
  useEffect(() => {
    const t = setTimeout(() => setBarPercent(getClimbLevelBarPercent(initialXp, tiers)), 120);
    return () => clearTimeout(t);
  }, [initialXp, tiers]);

  // Advance through level-up modal queue
  useEffect(() => {
    if (!activeModal && levelUpQueue.length > 0) {
      const [next, ...rest] = levelUpQueue;
      setLevelUpQueue(rest);
      setActiveModal(next);
    }
  }, [activeModal, levelUpQueue]);

  const tiersWithStatus = computeUnlockedTiers(displayXp, tiers);
  const currentClimbLevel = getCurrentClimbLevel(displayXp, tiers);
  const nextTier = getNextTier(displayXp, tiers);
  const unlockedCount = tiersWithStatus.filter((t) => t.unlocked).length;
  const prevTier = [...tiersWithStatus].reverse().find((t) => t.unlocked) ?? null;

  const careerProgress = getCareerLevelProgress(displayCareerXp);

  async function handleClaim() {
    if (phase !== "idle" || claimed) return;
    setPhase("claiming");

    const result = await claimPendingXp(communityId);
    if ("error" in result) {
      setPhase("idle");
      return;
    }

    const targetXp = initialXp + pendingTotal;
    const targetCareerXp = initialCareerXp + pendingTotal;
    const currencyAward = Math.floor(pendingTotal / 2);
    const targetCurrency = initialCurrency + currencyAward;
    setPhase("animating");

    setFloats(
      pendingItems.slice(0, 4).map((item, i) => ({
        id: Date.now() + i,
        amount: item.amount,
        left: Math.min(95, getClimbLevelBarPercent(initialXp, tiers) + i * 3),
      }))
    );

    animateValue(
      initialXp,
      targetXp,
      1800,
      (v) => {
        setDisplayXp(v);
        setDisplayCareerXp(initialCareerXp + (v - initialXp));
        setBarPercent(getClimbLevelBarPercent(v, tiers));
        if (currencyAward > 0) {
          const progress = pendingTotal > 0 ? (v - initialXp) / pendingTotal : 1;
          setDisplayCurrency(Math.round(initialCurrency + currencyAward * progress));
        }
        tiers.forEach((tier) => {
          if (v >= tier.xp_required && initialXp < tier.xp_required) {
            setNewlyUnlocked((prev) => new Set([...prev, tier.id]));
          }
        });
      },
      () => {
        setDisplayCareerXp(targetCareerXp);
        setDisplayCurrency(targetCurrency);
        setPhase("done");
        setClaimed(true);

        // Build level-up modal queue
        const queue: LevelUpEvent[] = [];
        const initLadder = getCurrentClimbLevel(initialXp, tiers);
        const finalLadder = getCurrentClimbLevel(targetXp, tiers);
        const initCareer = getCareerLevel(initialCareerXp);
        const finalCareer = getCareerLevel(targetCareerXp);
        if (finalLadder > initLadder) {
          queue.push({ id: 1, type: "ladder", fromLevel: initLadder, toLevel: finalLadder });
        }
        if (finalCareer > initCareer) {
          queue.push({ id: 2, type: "career", fromLevel: initCareer, toLevel: finalCareer });
        }
        if (queue.length > 0) {
          setLevelUpQueue(queue.slice(1));
          setActiveModal(queue[0]);
        }

        // Check for newly earned career milestone badges
        checkCareerMilestones().then((result) => {
          if (result.newAwards.length > 0) {
            setNewMilestones(result.newAwards);
          }
        });

        setTimeout(() => {
          setFloats([]);
          router.refresh();
        }, 600);
      }
    );
  }

  return (
    <>
    {activeModal && (
      <LevelUpModal
        event={activeModal}
        onDismiss={() => setActiveModal(null)}
      />
    )}
    <div className="space-y-4">
      {/* ── Climb Level Card ──────────────────────────────────────────────────── */}
      <div className="card relative overflow-hidden px-6 py-5">
        <div className="pointer-events-none absolute inset-0 -z-10 rounded-xl bg-gradient-to-br from-violet-500/10 via-indigo-500/5 to-transparent blur-xl" />
        {showParticles && (
          <div className="claim-particles">
            {particles.map((p) => (
              <span
                key={p.id}
                className="claim-particle"
                style={
                  {
                    "--p-left": p.left,
                    "--p-delay": p.delay,
                    "--p-duration": p.duration,
                    "--p-size": p.size,
                  } as CSSProperties
                }
              />
            ))}
          </div>
        )}

        {/* Top row */}
        <div className="xp-card-content mb-3 flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-600">
            This Season
          </p>
          <p className="text-[10px] font-medium text-gray-700">
            {season.name} · {unlockedCount}/{tiersWithStatus.length} levels
          </p>
        </div>

        {/* Hero row: "Ladder Level N" + XP info */}
        <div className="xp-card-content mb-5 flex items-end justify-between gap-4">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold uppercase tracking-widest text-gray-500 leading-none mb-1.5">
              Climb Level
            </span>
            <span
              key={currentClimbLevel}
              className={`level-tick-in text-7xl font-extrabold tracking-tight tabular-nums leading-none transition-colors duration-300 ${
                phase === "animating" ? "text-violet-300" : "text-white"
              }`}
            >
              {currentClimbLevel}
            </span>
            {hasPending && !claimed && (
              <span className="animate-pulse rounded-full bg-violet-500/20 px-2 py-0.5 text-xs font-bold text-violet-300 ring-1 ring-violet-500/30">
                +{pendingTotal} pending
              </span>
            )}
          </div>
          <div className="text-right pb-1">
            <p className={`text-3xl font-bold tabular-nums transition-colors duration-300 ${phase === "animating" ? "text-violet-300" : "text-gray-300"}`}>
              {displayXp.toLocaleString()}
              <span className="ml-1 text-base font-semibold text-gray-600">XP</span>
            </p>
            <p className="mt-0.5 text-base font-bold tabular-nums" style={{ color: "var(--neon-cyan)" }}>
              {displayCurrency.toLocaleString()}
              <span className="ml-1 text-xs font-semibold" style={{ color: "color-mix(in srgb, var(--neon-cyan) 55%, transparent)" }}>ascnd pts</span>
            </p>
            {nextTier ? (
              <p className="mt-0.5 text-xs text-gray-600">
                {(nextTier.xp_required - displayXp).toLocaleString()} XP to Level {nextTier.tier_number}
              </p>
            ) : tiers.length > 0 ? (
              <p className="mt-0.5 flex items-center justify-end gap-1 text-xs font-semibold text-emerald-400">
                <Trophy className="h-3.5 w-3.5" /> Max level reached!
              </p>
            ) : null}
          </div>
        </div>

        {/* XP Bar */}
        <div className="xp-card-content relative z-[200]">
          <div
            className="xp-bar-track relative h-6 overflow-hidden z-[210]"
            style={{
              border: "1px solid color-mix(in srgb, var(--neon-cyan) 50%, transparent)",
              background: "linear-gradient(180deg, rgba(6, 10, 19, 0.95), rgba(9, 16, 30, 0.98))",
              boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--neon-cyan) 12%, transparent), inset 0 -10px 20px rgba(0,0,0,0.6), 0 0 14px color-mix(in srgb, var(--neon-cyan) 18%, transparent)",
            }}
          >
            <div className="xp-bar-grid absolute inset-0" />
            <div
              className="xp-bar-fill absolute inset-y-0 left-0 z-[220]"
              style={{
                width: fillWidth,
                minWidth: safePercent > 0 ? "2px" : "0",
                background: "linear-gradient(90deg, var(--neon-cyan) 0%, var(--neon-lime) 52%, var(--neon-amber) 100%)",
                boxShadow: "0 0 22px color-mix(in srgb, var(--neon-cyan) 75%, transparent), 0 0 12px color-mix(in srgb, var(--neon-lime) 45%, transparent)",
              }}
            />
          </div>

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
        <div className="xp-card-content mt-2 flex justify-between text-[10px] text-gray-700">
          <span>{prevTier ? `Level ${prevTier.tier_number}` : "Start"}</span>
          <span className="font-medium text-gray-600">
            {displayXp.toLocaleString()} / {nextTier?.xp_required.toLocaleString() ?? tiers[tiers.length - 1]?.xp_required.toLocaleString() ?? "—"} XP
          </span>
          <span>{nextTier ? `Level ${nextTier.tier_number}` : "Max"}</span>
        </div>
      </div>

      {/* ── Career Level Card ─────────────────────────────────────────────────── */}
      <div className="card px-5 py-4 flex items-center gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center bg-violet-500/15 rounded-xl">
          <Star className="h-5 w-5 text-violet-300" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2 mb-2">
            <div className="flex flex-col gap-0.5">
              <div className="flex items-baseline gap-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-500">Career Level</span>
                <span
                  key={careerProgress.level}
                  className={`level-tick-in text-2xl font-extrabold tabular-nums leading-none transition-colors duration-300 ${
                    phase === "animating" ? "text-violet-300" : "text-white"
                  }`}
                >
                  {careerProgress.level}
                </span>
              </div>
              {getRankTitle(careerProgress.level) && (
                <span
                  key={`rank-${careerProgress.level}`}
                  className={`level-tick-in text-[10px] font-bold uppercase tracking-widest ${
                    phase === "animating" ? "text-violet-400" : "text-violet-400/70"
                  }`}
                >
                  {getRankTitle(careerProgress.level)}
                </span>
              )}
            </div>
            <span className="text-xs text-gray-600 tabular-nums">
              {displayCareerXp.toLocaleString()} XP total
            </span>
          </div>
          {/* mini progress bar */}
          <div
            className="relative h-1.5 overflow-hidden"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.07)",
            }}
          >
            <div
              className="absolute inset-y-0 left-0"
              style={{
                width: `${careerProgress.percent}%`,
                background: "linear-gradient(90deg, var(--neon-cyan), var(--neon-lime))",
                transition: "width 0.4s ease",
              }}
            />
          </div>
          <p className="mt-1 text-[10px] text-gray-700">
            {careerProgress.xpToNext} XP to Level {careerProgress.level + 1}
          </p>
        </div>
      </div>

      {/* ── Claim Card ───────────────────────────────────────────────────────── */}
      {hasPending && !claimed && (
        <div className="xp-claim-card rounded-xl p-px">
          <div className="relative rounded-[11px] bg-[#0f0f1a] px-6 py-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/20 text-lg">
                <Sparkles className="h-5 w-5 text-violet-300" />
              </div>
              <div>
                <p className="font-bold text-white">XP Ready to Claim</p>
                <p className="text-xs text-gray-500">Tap to collect your rewards</p>
              </div>
              <span className="ml-auto rounded-full bg-violet-500/20 px-3 py-1 text-sm font-extrabold text-violet-300 ring-1 ring-violet-500/30">
                +{pendingTotal} XP
              </span>
            </div>

            <div className="mb-5 space-y-2">
              {pendingItems.map((item) => {
                const ReasonIcon = REASON_ICON[item.reason] ?? Star;
                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-lg bg-white/[0.04] px-4 py-2.5"
                  >
                    <div className="flex items-center gap-2.5">
                      <ReasonIcon className="h-4 w-4 text-violet-300" />
                      <span className="text-sm text-gray-300">{REASON_LABEL[item.reason] ?? item.reason}</span>
                    </div>
                    <span className="text-sm font-bold text-violet-300">+{item.amount} XP</span>
                  </div>
                );
              })}
            </div>

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
            <p className="text-xs" style={{ color: "var(--neon-cyan)" }}>+{Math.floor(pendingTotal / 2)} ascnd pts earned</p>
          </div>
        </div>
      )}

      {/* ── New career milestone awards ───────────────────────────────────────── */}
      {newMilestones.length > 0 && (
        <div className="card px-5 py-4">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-cyan-400">
            Career Milestone{newMilestones.length > 1 ? "s" : ""} Unlocked!
          </p>
          <div className="space-y-2.5">
            {newMilestones.map((m) => (
              <div key={m.id} className="flex items-center gap-3">
                <span className="text-2xl leading-none">{m.icon}</span>
                <div>
                  <p className="text-sm font-semibold text-white">{m.name}</p>
                  <p className="text-xs text-gray-600">Career Level {m.level_required}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Climb Levels List ────────────────────────────────────────────────── */}
      {tiersWithStatus.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 py-10 text-center">
          <p className="text-sm text-gray-600">No climb levels configured for this season yet.</p>
        </div>
      ) : (
        <>
          <p className="label mt-2">Climb Levels</p>
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
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg ${
                      isNew
                        ? "bg-yellow-500/20"
                        : tier.unlocked
                        ? "bg-emerald-500/15"
                        : "bg-white/[0.04]"
                    }`}
                  >
                    {isNew ? (
                      <PartyPopper className="h-5 w-5 text-yellow-300" />
                    ) : tier.unlocked ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-300" />
                    ) : (
                      <Lock className="h-5 w-5 text-gray-500" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white">
                      Level {tier.tier_number}
                      {tier.reward_label && (
                        <span className="ml-2 font-normal text-gray-500">· {tier.reward_label}</span>
                      )}
                    </p>
                    <p className="text-xs text-gray-600">{tier.xp_required.toLocaleString()} XP required</p>
                  </div>

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
        </>
      )}
    </div>
    </>
  );
}
