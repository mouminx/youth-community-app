"use client";

import { useState } from "react";

type Entry = {
  user_id: string;
  display_name: string;
  avatar_url: string;
  xp_total: number;
  rank: number;
};

export function LeaderboardTabs({
  weekly,
  season,
  myWeekly,
  mySeason,
  userId,
}: {
  weekly: Entry[];
  season: Entry[];
  myWeekly: Entry | null;
  mySeason: Entry | null;
  userId: string;
}) {
  const [tab, setTab] = useState<"weekly" | "season">("weekly");

  const entries = tab === "weekly" ? weekly : season;
  const myRank = tab === "weekly" ? myWeekly : mySeason;
  const isInTop = entries.some((e) => e.user_id === userId);

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Page header */}
      <div className="border-b border-white/[0.06] px-8 py-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-white">Leaderboard</h1>
            <p className="mt-0.5 text-sm text-gray-600">Top XP earners in this community</p>
          </div>
          <div className="flex rounded-lg border border-white/[0.07] overflow-hidden">
            <button
              onClick={() => setTab("weekly")}
              className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                tab === "weekly" ? "bg-indigo-600 text-white" : "text-gray-400 hover:text-gray-200"
              }`}
            >
              Weekly
            </button>
            <button
              onClick={() => setTab("season")}
              className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                tab === "season" ? "bg-indigo-600 text-white" : "text-gray-400 hover:text-gray-200"
              }`}
            >
              Season
            </button>
          </div>
        </div>
      </div>

      <div className="px-8 py-6 space-y-4">
        {/* My rank (if not in top list) */}
        {myRank && !isInTop && (
          <div className="card flex items-center gap-4 px-5 py-3.5 border-indigo-500/20 bg-indigo-600/5">
            <span className="w-8 font-mono text-sm font-bold text-indigo-400">#{myRank.rank}</span>
            <div className="flex-1">
              <p className="text-sm font-medium text-white">Your rank</p>
            </div>
            <span className="text-sm font-bold text-indigo-300">{myRank.xp_total} XP</span>
          </div>
        )}

        {entries.length === 0 ? (
          <div className="card flex flex-col items-center gap-3 py-12 text-center">
            <svg className="h-8 w-8 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <p className="text-sm text-gray-600">
              {tab === "season" ? "No active season or no XP earned yet." : "No XP earned this week."}
            </p>
          </div>
        ) : (
          <div className="card overflow-hidden">
            {entries.map((entry, idx) => {
              const isMe = entry.user_id === userId;
              const rankColors: Record<number, string> = {
                1: "text-amber-300",
                2: "text-gray-300",
                3: "text-orange-400",
              };

              return (
                <div
                  key={entry.user_id}
                  className={`flex items-center gap-4 px-5 py-3.5 ${
                    idx !== 0 ? "border-t border-white/[0.04]" : ""
                  } ${isMe ? "bg-indigo-600/5" : "hover:bg-white/[0.02]"} transition-colors`}
                >
                  <span className={`w-8 font-mono text-sm font-bold ${rankColors[entry.rank] ?? "text-gray-600"}`}>
                    #{entry.rank}
                  </span>

                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-600/20 text-sm font-bold text-indigo-300">
                    {(entry.display_name || "?").charAt(0).toUpperCase()}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${isMe ? "text-indigo-300" : "text-white"}`}>
                      {entry.display_name || "Unnamed"}
                      {isMe && <span className="ml-2 text-xs text-indigo-500">(you)</span>}
                    </p>
                  </div>

                  <span className="text-sm font-bold text-white tabular-nums">{entry.xp_total} XP</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
