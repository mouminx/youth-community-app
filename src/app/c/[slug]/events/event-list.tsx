"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { rsvpEvent } from "@/actions/events";
import { AttendanceModal } from "./attendance-modal";

type Event = {
  id: string;
  title: string;
  description: string;
  location: string;
  start_time: string;
  end_time: string | null;
  event_rsvps: { user_id: string }[];
};

export function EventList({
  events,
  userId,
  isMentor,
  isPast,
}: {
  events: Event[];
  userId: string;
  isMentor: boolean;
  isPast?: boolean;
}) {
  if (events.length === 0) {
    return (
      <div className="card flex flex-col items-center gap-3 py-12 text-center">
        <svg className="h-8 w-8 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <p className="text-sm text-gray-600">No events here yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {events.map((event) => (
        <EventCard
          key={event.id}
          event={event}
          userId={userId}
          isMentor={isMentor}
        />
      ))}
    </div>
  );
}

function EventCard({
  event,
  userId,
  isMentor,
}: {
  event: Event;
  userId: string;
  isMentor: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const hasRsvp = event.event_rsvps?.some((r) => r.user_id === userId);
  const rsvpCount = event.event_rsvps?.length ?? 0;

  const start = new Date(event.start_time);
  const end = event.end_time ? new Date(event.end_time) : null;

  async function handleRsvp() {
    setLoading(true);
    await rsvpEvent(event.id, hasRsvp ? "cancel" : "rsvp");
    router.refresh();
    setLoading(false);
  }

  return (
    <div className="card px-5 py-4">
      <div className="flex items-start gap-4">
        {/* Date badge */}
        <div className="shrink-0 rounded-lg bg-indigo-600/10 p-2.5 text-center min-w-[52px]">
          <p className="text-xs font-bold text-indigo-300 leading-none">
            {start.toLocaleDateString("en", { month: "short" }).toUpperCase()}
          </p>
          <p className="text-xl font-bold text-indigo-200 leading-tight">
            {start.getDate()}
          </p>
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium text-white truncate">{event.title}</p>
              {event.description && (
                <p className="mt-0.5 text-sm text-gray-500 line-clamp-2">{event.description}</p>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-600">
                <span>
                  {start.toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" })}
                  {end && ` – ${end.toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" })}`}
                </span>
                {event.location && (
                  <span className="flex items-center gap-1">
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {event.location}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {rsvpCount} RSVP{rsvpCount !== 1 ? "s" : ""}
                </span>
              </div>
            </div>

            <button
              onClick={handleRsvp}
              disabled={loading}
              className={`shrink-0 btn btn-sm ${hasRsvp ? "btn-ghost" : "btn-primary"}`}
            >
              {loading ? (
                <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : hasRsvp ? "Cancel RSVP" : "RSVP"}
            </button>
          </div>

          {/* Mentors+ see the attendance marking UI */}
          {isMentor && (
            <div className="mt-3 border-t border-white/[0.04] pt-3">
              <AttendanceModal eventId={event.id} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
