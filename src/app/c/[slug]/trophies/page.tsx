import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { getCommunityBySlug, getMembership } from "@/lib/rbac";
import { listTrophiesWithAwards, type TrophyWithAwards } from "@/actions/trophies";

function TrophyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0" />
    </svg>
  );
}

function StarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

function TrophyCard({ trophy }: { trophy: TrophyWithAwards }) {
  const hasAwards = trophy.awards.length > 0;

  return (
    <div
      className="card p-6 space-y-4"
      style={
        hasAwards
          ? { boxShadow: "inset 0 1px 0 rgba(255,211,61,0.08), 0 0 0 1px rgba(255,211,61,0.18), 0 0 28px rgba(255,211,61,0.06)" }
          : undefined
      }
    >
      {/* Trophy header */}
      <div className="flex items-start gap-4">
        <div
          className="flex h-14 w-14 shrink-0 items-center justify-center"
          style={{
            background: hasAwards ? "rgba(255,211,61,0.12)" : "rgba(255,255,255,0.04)",
            border: hasAwards ? "1px solid rgba(255,211,61,0.25)" : "1px solid rgba(255,255,255,0.07)",
          }}
        >
          {trophy.icon_url ? (
            <img
              src={trophy.icon_url}
              alt={trophy.name}
              className="h-10 w-10 object-contain"
              style={hasAwards ? undefined : { filter: "grayscale(1) opacity(0.4)" }}
            />
          ) : (
            <TrophyIcon
              className={`h-7 w-7 ${hasAwards ? "text-[#ffd33d]" : "text-gray-700"}`}
            />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`font-semibold leading-tight ${hasAwards ? "text-white" : "text-gray-500"}`}>
            {trophy.name}
          </p>
          {trophy.description && (
            <p className="mt-0.5 text-xs text-gray-600 leading-relaxed">{trophy.description}</p>
          )}
          <div className="mt-2 flex items-center gap-1.5">
            <StarIcon className="h-3 w-3 text-amber-400" />
            <span className="text-[11px] font-semibold text-amber-400">+{trophy.xp_award} Career XP</span>
          </div>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            hasAwards
              ? "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/25"
              : "bg-white/[0.05] text-gray-600"
          }`}
        >
          {trophy.awards.length} earned
        </span>
      </div>

      {/* Recipients */}
      {hasAwards && (
        <div className="space-y-2 border-t border-white/[0.05] pt-4">
          {trophy.awards.map((award) => (
            <div key={award.id} className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-300 text-xs font-bold">
                  {award.recipient_name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{award.recipient_name}</p>
                  {award.notes && (
                    <p className="text-[10px] text-gray-600 italic">{award.notes}</p>
                  )}
                </div>
              </div>
              <p className="text-[10px] text-gray-700 font-mono">
                {new Date(award.awarded_at).toLocaleDateString("en", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default async function TrophiesPage({
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

  const trophies = await listTrophiesWithAwards(community.id);
  const totalAwarded = trophies.reduce((sum, t) => sum + t.awards.length, 0);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="border-b border-white/[0.06] px-8 py-5">
        <h1 className="text-lg font-semibold text-white">Trophies</h1>
        <p className="mt-0.5 text-sm text-gray-600">
          {trophies.length} trophy{trophies.length === 1 ? "" : "s"} · {totalAwarded} total awarded
        </p>
      </div>

      <div className="px-8 py-6">
        {trophies.length === 0 ? (
          <div className="card flex flex-col items-center gap-3 py-16 text-center">
            <TrophyIcon className="h-10 w-10 text-gray-700" />
            <div>
              <p className="text-sm font-medium text-gray-500">No trophies yet</p>
              <p className="mt-1 text-xs text-gray-700">
                Admins can create custom trophies and award them to members from the Management panel.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {trophies.map((trophy) => (
              <TrophyCard key={trophy.id} trophy={trophy} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
