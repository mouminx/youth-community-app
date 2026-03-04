import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { getCommunityBySlug, getMembership } from "@/lib/rbac";
import { listBadgesWithStatus, type BadgeWithStatus } from "@/actions/badges";
import { checkCareerMilestones, getCareerMilestonesWithStatus, type CareerMilestoneWithStatus } from "@/actions/career-milestones";

function BadgeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
    </svg>
  );
}

function BadgeCard({ badge }: { badge: BadgeWithStatus }) {
  const earnedDate = badge.earned_at
    ? new Date(badge.earned_at).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" })
    : null;

  if (badge.earned) {
    return (
      <div
        className="card p-5 flex flex-col items-center gap-3 text-center"
        style={{ boxShadow: "inset 0 1px 0 rgba(204,241,255,0.06), 0 0 0 1px rgba(59,232,255,0.2), 0 0 22px rgba(59,232,255,0.1)" }}
      >
        <div className="flex h-14 w-14 items-center justify-center bg-[rgba(59,232,255,0.1)] border border-[rgba(59,232,255,0.2)]">
          {badge.icon_url ? (
            <img src={badge.icon_url} alt={badge.name} className="h-10 w-10 object-contain" />
          ) : (
            <BadgeIcon className="h-7 w-7 text-[#9dfff4]" />
          )}
        </div>
        <p className="text-sm font-semibold text-white leading-tight">{badge.name}</p>
        {badge.description && (
          <p className="text-xs text-gray-500 leading-relaxed">{badge.description}</p>
        )}
        {earnedDate && (
          <p className="text-[10px] text-[rgba(59,232,255,0.6)] font-mono uppercase tracking-wide">
            Earned {earnedDate}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="card p-5 flex flex-col items-center gap-3 text-center relative" style={{ opacity: 0.38 }}>
      <span className="absolute top-2.5 right-2.5 text-gray-600">
        <LockIcon />
      </span>
      <div className="flex h-14 w-14 items-center justify-center bg-white/[0.03] border border-white/[0.06]">
        {badge.icon_url ? (
          <img src={badge.icon_url} alt={badge.name} className="h-10 w-10 object-contain" style={{ filter: "grayscale(1)" }} />
        ) : (
          <BadgeIcon className="h-7 w-7 text-gray-700" />
        )}
      </div>
      <p className="text-sm font-semibold text-gray-500 leading-tight">{badge.name}</p>
      {badge.description && (
        <p className="text-xs text-gray-600 leading-relaxed">{badge.description}</p>
      )}
      <p className="text-[10px] text-gray-700 font-mono uppercase tracking-wide">Locked</p>
    </div>
  );
}

function MilestoneCard({ milestone }: { milestone: CareerMilestoneWithStatus }) {
  const earnedDate = milestone.earned_at
    ? new Date(milestone.earned_at).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" })
    : null;

  if (milestone.earned) {
    return (
      <div
        className="card p-5 flex flex-col items-center gap-3 text-center"
        style={{ boxShadow: "inset 0 1px 0 rgba(204,241,255,0.06), 0 0 0 1px rgba(59,232,255,0.2), 0 0 22px rgba(59,232,255,0.1)" }}
      >
        <div className="flex h-14 w-14 items-center justify-center bg-[rgba(59,232,255,0.08)] border border-[rgba(59,232,255,0.18)] text-4xl leading-none">
          {milestone.icon}
        </div>
        <p className="text-sm font-semibold text-white leading-tight">{milestone.name}</p>
        <p className="text-xs text-gray-500 leading-relaxed">{milestone.description}</p>
        {earnedDate && (
          <p className="text-[10px] text-[rgba(59,232,255,0.6)] font-mono uppercase tracking-wide">
            Earned {earnedDate}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="card p-5 flex flex-col items-center gap-3 text-center relative" style={{ opacity: 0.38 }}>
      <span className="absolute top-2.5 right-2.5 text-gray-600">
        <LockIcon />
      </span>
      <div className="flex h-14 w-14 items-center justify-center bg-white/[0.03] border border-white/[0.06] text-4xl leading-none" style={{ filter: "grayscale(1)" }}>
        {milestone.icon}
      </div>
      <p className="text-sm font-semibold text-gray-500 leading-tight">{milestone.name}</p>
      <p className="text-xs text-gray-600 leading-relaxed">Reach Career Level {milestone.level_required}</p>
      <p className="text-[10px] text-gray-700 font-mono uppercase tracking-wide">Locked</p>
    </div>
  );
}

export default async function BadgesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const community = await getCommunityBySlug(supabase, slug);
  const membership = await getMembership(supabase, community.id, user.id);
  if (!membership) redirect(`/c/${slug}`);

  // Ensure any newly eligible career milestones are awarded before reading them.
  // This handles: (a) users who levelled up before milestones were added,
  // (b) newly added milestone tiers in future releases.
  await checkCareerMilestones();

  const [badges, milestones] = await Promise.all([
    listBadgesWithStatus(community.id),
    getCareerMilestonesWithStatus(user.id),
  ]);

  const earnedBadges = badges.filter((b) => b.earned);
  const lockedBadges = badges.filter((b) => !b.earned);
  const earnedMilestones = milestones.filter((m) => m.earned);
  const lockedMilestones = milestones.filter((m) => !m.earned);
  const totalEarned = earnedBadges.length + earnedMilestones.length;
  const totalAll = badges.length + milestones.length;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="border-b border-white/[0.06] px-8 py-5">
        <h1 className="text-lg font-semibold text-white">Badges</h1>
        <p className="mt-0.5 text-sm text-gray-600">
          {totalEarned} of {totalAll} earned
        </p>
      </div>

      <div className="px-8 py-6 space-y-8">

        {/* ── Community Badges ──────────────────────────────────── */}
        <section>
          <h2 className="mb-1 text-sm font-semibold text-white">Community Badges</h2>
          <p className="mb-4 text-xs text-gray-600">{earnedBadges.length} of {badges.length} earned</p>

          {badges.length === 0 ? (
            <div className="card flex flex-col items-center gap-3 py-10 text-center">
              <BadgeIcon className="h-8 w-8 text-gray-700" />
              <p className="text-sm text-gray-600">No community badges have been created yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {earnedBadges.map((b) => <BadgeCard key={b.id} badge={b} />)}
              {lockedBadges.map((b) => <BadgeCard key={b.id} badge={b} />)}
            </div>
          )}
        </section>

        {/* ── Career Milestones ─────────────────────────────────── */}
        <section>
          <h2 className="mb-1 text-sm font-semibold text-white">Career Milestones</h2>
          <p className="mb-4 text-xs text-gray-600">{earnedMilestones.length} of {milestones.length} reached · Earned by levelling up across all communities</p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {earnedMilestones.map((m) => <MilestoneCard key={m.id} milestone={m} />)}
            {lockedMilestones.map((m) => <MilestoneCard key={m.id} milestone={m} />)}
          </div>
        </section>

      </div>
    </div>
  );
}
