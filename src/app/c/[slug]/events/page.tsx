import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { getCommunityBySlug, getMembership, meetsRole } from "@/lib/rbac";
import { listEvents } from "@/actions/events";
import { EventList } from "./event-list";
import { CreateEventForm } from "./create-event-form";

export default async function EventsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const community = await getCommunityBySlug(supabase, slug);
  const membership = await getMembership(supabase, community.id, user.id);
  if (!membership) redirect(`/c/${slug}`);

  const { upcoming, past } = await listEvents(community.id);
  const isMentor = meetsRole(membership.role, "mentor");

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b border-white/[0.06] px-8 py-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-white">Events</h1>
            <p className="mt-0.5 text-sm text-gray-600">
              {upcoming.length} upcoming · {past.length} past
            </p>
          </div>
          {isMentor && <CreateEventForm communityId={community.id} slug={slug} />}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-8 py-6 space-y-8">
        {/* Upcoming */}
        <section>
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-gray-600">Upcoming</h2>
          {upcoming.length === 0 ? (
            <EmptyState label="No upcoming events" />
          ) : (
            <EventList events={upcoming} userId={user.id} isMentor={isMentor} />
          )}
        </section>

        {/* Past */}
        {past.length > 0 && (
          <section>
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-gray-600">Past</h2>
            <EventList events={past} userId={user.id} isMentor={isMentor} isPast />
          </section>
        )}
      </div>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="card flex flex-col items-center gap-3 py-12 text-center">
      <svg className="h-8 w-8 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
      <p className="text-sm text-gray-600">{label}</p>
    </div>
  );
}
