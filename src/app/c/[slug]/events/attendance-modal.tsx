"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { listAttendeesForEvent, markAttendance } from "@/actions/attendance";

type Member = {
  user_id: string;
  display_name: string;
  has_rsvp: boolean;
  attended: boolean;
};

export function AttendanceModal({ eventId }: { eventId: string }) {
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [result, setResult] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    setFetching(true);
    listAttendeesForEvent(eventId).then((res) => {
      if (res.data) {
        setMembers(res.data);
        const preSelected = new Set(
          res.data.filter((m) => m.has_rsvp && !m.attended).map((m) => m.user_id)
        );
        setSelected(preSelected);
      }
      setFetching(false);
    });
  }, [open, eventId]);

  function toggle(userId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  async function handleSubmit() {
    setLoading(true);
    setResult(null);
    const res = await markAttendance(eventId, Array.from(selected));
    if (res.error) {
      setResult({ type: "error", text: res.error });
    } else {
      setResult({
        type: "success",
        text: `Marked ${res.data!.marked} attendee(s). ${res.data!.skipped} already marked.`,
      });
      router.refresh();
    }
    setLoading(false);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="btn-sm inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-400 transition-colors hover:bg-emerald-500/20"
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
        Mark Attendance
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-white/[0.07] bg-[#0e0e18] p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-white">Mark Attendance</p>
          <p className="text-xs text-gray-600">+50 XP per attendee</p>
        </div>
        <button
          onClick={() => { setOpen(false); setResult(null); }}
          className="text-gray-600 hover:text-gray-400 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {fetching ? (
        <div className="flex items-center justify-center py-6">
          <svg className="h-5 w-5 animate-spin text-indigo-400" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : members.length === 0 ? (
        <p className="py-4 text-center text-sm text-gray-600">No community members found.</p>
      ) : (
        <div className="max-h-56 space-y-1 overflow-y-auto">
          {members.map((m) => (
            <label
              key={m.user_id}
              className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 transition-colors ${
                m.attended ? "opacity-50" : "hover:bg-white/[0.03]"
              }`}
            >
              <input
                type="checkbox"
                checked={selected.has(m.user_id)}
                onChange={() => toggle(m.user_id)}
                disabled={m.attended}
                className="h-4 w-4 rounded accent-indigo-500"
              />
              <span className={`flex-1 text-sm ${m.attended ? "line-through text-gray-600" : "text-gray-300"}`}>
                {m.display_name || "Unnamed"}
              </span>
              <div className="flex items-center gap-1.5">
                {m.has_rsvp && (
                  <span className="rounded-full bg-indigo-500/10 px-1.5 py-0.5 text-xs text-indigo-400">RSVP</span>
                )}
                {m.attended && (
                  <span className="rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-xs text-emerald-400">Done</span>
                )}
              </div>
            </label>
          ))}
        </div>
      )}

      {result && (
        <div className={`mt-3 flex items-start gap-2 rounded-lg border px-3 py-2.5 ${
          result.type === "success"
            ? "border-emerald-500/20 bg-emerald-500/10"
            : "border-red-500/20 bg-red-500/10"
        }`}>
          <p className={`text-sm ${result.type === "success" ? "text-emerald-400" : "text-red-400"}`}>
            {result.text}
          </p>
        </div>
      )}

      <div className="mt-3 flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={loading || selected.size === 0}
          className="btn-primary btn-sm"
        >
          {loading ? "Saving…" : `Save ${selected.size} attendee${selected.size !== 1 ? "s" : ""}`}
        </button>
        <button
          onClick={() => { setOpen(false); setResult(null); }}
          className="btn-ghost btn-sm"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
