"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { markAsRead, type UnreadCounts } from "@/actions/notifications";

/* ── Icons ─────────────────────────────────────────────────────────── */
const Icon = {
  Home: () => (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.006 3.705a.75.75 0 1 0-.512-1.41L6 6.838V3a.75.75 0 0 0-.75-.75h-1.5A.75.75 0 0 0 3 3v4.93l-1.006.365a.75.75 0 0 0 .512 1.41l16.5-6Z" />
      <path fillRule="evenodd" d="M3.019 11.114 18 5.667v3.421l4.006 1.457a.75.75 0 1 1-.512 1.41l-.494-.18v8.475h.75a.75.75 0 0 1 0 1.5H2.25a.75.75 0 0 1 0-1.5H3v-9.129l.019-.007ZM18 20.25v-9.566l1.5.546v9.02H18Zm-9-6a.75.75 0 0 0-.75.75v4.5c0 .414.336.75.75.75h3a.75.75 0 0 0 .75-.75V15a.75.75 0 0 0-.75-.75H9Z" clipRule="evenodd" />
    </svg>
  ),
  Calendar: () => (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.75 12.75a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM7.5 15.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM8.25 17.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM9.75 15.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM10.5 17.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM12 15.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM12.75 17.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM14.25 15.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM15 17.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM16.5 15.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM15 12.75a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM16.5 13.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" />
      <path fillRule="evenodd" d="M6.75 2.25A.75.75 0 0 1 7.5 3v1.5h9V3A.75.75 0 0 1 18 3v1.5h.75a3 3 0 0 1 3 3v11.25a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3V7.5a3 3 0 0 1 3-3H6V3a.75.75 0 0 1 .75-.75Zm13.5 9a1.5 1.5 0 0 0-1.5-1.5H5.25a1.5 1.5 0 0 0-1.5 1.5v7.5a1.5 1.5 0 0 0 1.5 1.5h13.5a1.5 1.5 0 0 0 1.5-1.5v-7.5Z" clipRule="evenodd" />
    </svg>
  ),
  User: () => (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
      <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM3.751 20.105a8.25 8.25 0 0 1 16.498 0 .75.75 0 0 1-.437.695A18.683 18.683 0 0 1 12 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 0 1-.437-.695Z" clipRule="evenodd" />
    </svg>
  ),
  Hash: () => (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
    </svg>
  ),
  Trophy: () => (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
      <path fillRule="evenodd" d="M5.166 2.621v.858c-1.035.148-2.059.33-3.071.543a.75.75 0 0 0-.584.859 6.753 6.753 0 0 0 6.138 5.6 6.73 6.73 0 0 0 2.743 1.346A6.707 6.707 0 0 1 9.279 15H8.54c-1.036 0-1.875.84-1.875 1.875V19.5h-.75a2.25 2.25 0 0 0-2.25 2.25c0 .414.336.75.75.75h15a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-2.25-2.25h-.75v-2.625c0-1.036-.84-1.875-1.875-1.875h-.739a6.706 6.706 0 0 1-1.112-3.173 6.73 6.73 0 0 0 2.743-1.347 6.753 6.753 0 0 0 6.139-5.6.75.75 0 0 0-.585-.858 47.077 47.077 0 0 0-3.07-.543V2.62a.75.75 0 0 0-.658-.744 49.22 49.22 0 0 0-6.093-.377c-2.063 0-4.096.128-6.093.377a.75.75 0 0 0-.657.744Zm0 2.629c0 1.196.312 2.32.857 3.294A5.266 5.266 0 0 1 3.16 5.337a45.6 45.6 0 0 1 2.006-.343v.256Zm13.5 0v-.256c.674.1 1.343.214 2.006.343a5.265 5.265 0 0 1-2.863 3.207 6.72 6.72 0 0 0 .857-3.294Z" clipRule="evenodd" />
    </svg>
  ),
  Star: () => (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
      <path fillRule="evenodd" d="M11.47 10.72a.75.75 0 0 1 1.06 0l7.5 7.5a.75.75 0 1 1-1.06 1.06L12 12.31l-6.97 6.97a.75.75 0 0 1-1.06-1.06l7.5-7.5Z" clipRule="evenodd" />
      <path fillRule="evenodd" d="M11.47 4.72a.75.75 0 0 1 1.06 0l7.5 7.5a.75.75 0 1 1-1.06 1.06L12 6.31l-6.97 6.97a.75.75 0 0 1-1.06-1.06l7.5-7.5Z" clipRule="evenodd" />
    </svg>
  ),
  Shield: () => (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  ),
  FileText: () => (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
      <path fillRule="evenodd" d="M4.125 3C3.089 3 2.25 3.84 2.25 4.875V18a3 3 0 0 0 3 3h15a3 3 0 0 1-3-3V4.875C17.25 3.839 16.41 3 15.375 3H4.125ZM12 9.75a.75.75 0 0 0 0 1.5h1.5a.75.75 0 0 0 0-1.5H12Zm-.75-2.25a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 0 1.5H12a.75.75 0 0 1-.75-.75ZM6 12.75a.75.75 0 0 0 0 1.5h7.5a.75.75 0 0 0 0-1.5H6Zm-.75 3.75a.75.75 0 0 1 .75-.75h7.5a.75.75 0 0 1 0 1.5H6a.75.75 0 0 1-.75-.75ZM6 6.75a.75.75 0 0 0-.75.75v3c0 .414.336.75.75.75h3a.75.75 0 0 0 .75-.75v-3A.75.75 0 0 0 9 6.75H6Z" clipRule="evenodd" />
      <path d="M18.75 6.75h1.875c.621 0 1.125.504 1.125 1.125V18a1.5 1.5 0 0 1-3 0V6.75Z" />
    </svg>
  ),
  Medal: () => (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
      <path fillRule="evenodd" d="M8.603 3.799A4.49 4.49 0 0 1 12 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 0 1 3.498 1.307 4.491 4.491 0 0 1 1.307 3.497A4.49 4.49 0 0 1 21.75 12a4.49 4.49 0 0 1-1.549 3.397 4.491 4.491 0 0 1-1.307 3.497 4.491 4.491 0 0 1-3.497 1.307A4.49 4.49 0 0 1 12 21.75a4.49 4.49 0 0 1-3.397-1.549 4.49 4.49 0 0 1-3.498-1.306 4.491 4.491 0 0 1-1.307-3.498A4.49 4.49 0 0 1 2.25 12c0-1.357.6-2.573 1.549-3.397a4.49 4.49 0 0 1 1.307-3.497 4.49 4.49 0 0 1 3.497-1.307Zm7.007 6.387a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clipRule="evenodd" />
    </svg>
  ),
  ChevronDoubleUp: () => (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
      <path fillRule="evenodd" d="M8.25 6.75a3.75 3.75 0 1 1 7.5 0 3.75 3.75 0 0 1-7.5 0ZM15.75 9.75a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM2.25 9.75a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM6.31 15.117A6.745 6.745 0 0 1 12 12a6.745 6.745 0 0 1 6.709 7.498.75.75 0 0 1-.372.568A12.696 12.696 0 0 1 12 21.75c-2.305 0-4.47-.612-6.337-1.684a.75.75 0 0 1-.372-.568 6.787 6.787 0 0 1 1.019-4.38Z" clipRule="evenodd" />
      <path d="M5.082 14.254a8.287 8.287 0 0 0-1.308 5.135 9.687 9.687 0 0 1-1.764-.44l-.115-.04a.563.563 0 0 1-.373-.487l-.01-.121a3.75 3.75 0 0 1 3.57-4.047ZM20.226 19.389a8.287 8.287 0 0 0-1.308-5.135 3.75 3.75 0 0 1 3.57 4.047l-.01.121a.563.563 0 0 1-.373.486l-.115.04c-.567.2-1.156.349-1.764.441Z" />
    </svg>
  ),
  AscndPoints: () => (
    <svg className="h-4" viewBox="0 0 18.49 24" fill="currentColor" style={{ width: "auto" }}>
      <path d="M14.67,2.73h-2.38V0h-2.57v2.73h-.95V0h-2.57v2.73H0v2.57h14.67c.69,0,1.22.56,1.22,1.22v4h-3.6v-4.05h-2.57v4.05h-.95v-4.05h-2.57v4.05H0v6.57c0,2.1,1.69,3.79,3.79,3.79h2.42v3.13h2.57v-3.13h.95v3.13h2.57v-3.13h6.2V6.52c0-2.1-1.69-3.79-3.82-3.79ZM15.89,18.31h-3.6v-4.05h-2.57v4.05h-.95v-4.05h-2.57v4.05h-2.42c-.66,0-1.22-.56-1.22-1.22v-4h13.33v5.22Z" />
    </svg>
  ),
};

function SidebarSection({ label }: { label: string }) {
  return (
    <div className="mb-1 mt-4 px-3">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-700">{label}</p>
    </div>
  );
}

function NavLink({
  href,
  icon,
  children,
  badge,
  active,
  color,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  badge?: React.ReactNode;
  active?: boolean;
  color?: string;
}) {
  return (
    <Link
      href={href}
      className={[
        "flex items-center gap-2.5 px-3 py-2 text-sm transition-all duration-150",
        active ? "bg-[var(--nav-active-bg)]" : "hover:bg-[var(--nav-hover-bg)]",
      ].join(" ")}
    >
      <span className="shrink-0" style={color ? { color } : undefined}>
        {icon}
      </span>
      <span
        className="flex-1 truncate transition-all duration-150"
        style={
          active
            ? {
                color: color ?? "var(--text-0)",
                textShadow: color
                  ? `0 0 8px ${color}, 0 0 22px color-mix(in srgb, ${color} 40%, transparent)`
                  : undefined,
              }
            : { color: "#6b7280" }
        }
      >
        {children}
      </span>
      {badge}
    </Link>
  );
}

function CountBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="notify-badge">
      {count > 99 ? "99+" : count}
    </span>
  );
}

function XpBadge() {
  return <span className="xp-notify-badge">XP</span>;
}

export function SidebarNav({
  channels,
  base,
  isMentor,
  communityId,
  initialUnreadCounts,
  currencyBalance,
  userId,
  userRole,
}: {
  channels: { id: string; name: string }[];
  base: string;
  isMentor: boolean;
  communityId: string;
  initialUnreadCounts: UnreadCounts;
  currencyBalance: number;
  userId: string;
  userRole: string;
}) {
  const pathname = usePathname();
  const [counts, setCounts] = useState<UnreadCounts>(initialUnreadCounts);

  useEffect(() => {
    const channelMatch = pathname.match(/\/chat\/([0-9a-f-]{36})/);
    if (channelMatch) {
      const channelId = channelMatch[1];
      markAsRead(communityId, `channel:${channelId}`);
      setCounts((prev) => ({
        ...prev,
        channels: { ...prev.channels, [channelId]: 0 },
      }));
      return;
    }

    if (pathname.includes("/feed")) {
      markAsRead(communityId, "feed");
      setCounts((prev) => ({ ...prev, feed: 0 }));
    }
  }, [pathname, communityId]);

  useEffect(() => {
    setCounts(initialUnreadCounts);
  }, [initialUnreadCounts]);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  return (
    <>
      <NavLink
        href={`${base}/profile/${userId}`}
        icon={
          <span className="flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden" style={{ border: "1px solid color-mix(in srgb, var(--neon-pink) 30%, transparent)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://api.dicebear.com/9.x/lorelei/svg?seed=${userId}&size=20`}
              alt="avatar"
              className="h-5 w-5"
            />
          </span>
        }
        active={isActive(`${base}/profile/${userId}`)}
        color="var(--neon-pink)"
      >
        My Profile
        <span className="ml-auto text-[9px] capitalize tracking-widest" style={{ color: "#6b7280" }}>{userRole}</span>
      </NavLink>
      <div className="mx-3 my-2" style={{ height: "1px", background: "rgba(255,255,255,0.05)" }} />

      <NavLink href={base} icon={<Icon.Home />} active={isActive(base) && pathname === base} color="var(--neon-cyan)">
        Dashboard
      </NavLink>
      <NavLink href={`${base}/events`} icon={<Icon.Calendar />} active={isActive(`${base}/events`)} color="var(--neon-lime)">
        Events
      </NavLink>
      <NavLink
        href={`${base}/feed`}
        icon={<Icon.FileText />}
        active={isActive(`${base}/feed`)}
        badge={<CountBadge count={counts.feed} />}
        color="var(--neon-lime)"
      >
        Feed
      </NavLink>

      <SidebarSection label="Channels" />
      {channels.length === 0 ? (
        <p className="px-3 py-1 text-xs text-gray-700">No channels yet</p>
      ) : (
        channels.map((ch) => (
          <NavLink
            key={ch.id}
            href={`${base}/chat/${ch.id}`}
            icon={<Icon.Hash />}
            active={isActive(`${base}/chat/${ch.id}`)}
            badge={<CountBadge count={counts.channels[ch.id] ?? 0} />}
            color="var(--neon-cyan)"
          >
            {ch.name}
          </NavLink>
        ))
      )}

      <SidebarSection label="Ladder" />
      <NavLink href={`${base}/leaderboard`} icon={<Icon.ChevronDoubleUp />} active={isActive(`${base}/leaderboard`)} color="var(--neon-amber)">
        Ladder
      </NavLink>
      <NavLink
        href={`${base}/battlepass`}
        icon={<Icon.Star />}
        active={isActive(`${base}/battlepass`)}
        badge={counts.hasPendingXp ? <XpBadge /> : undefined}
        color="var(--neon-amber)"
      >
        Seasonal Climb
      </NavLink>
      <NavLink href={`${base}/badges`} icon={<Icon.Medal />} active={isActive(`${base}/badges`)} color="var(--neon-pink)">
        Badges
      </NavLink>
      <NavLink href={`${base}/trophies`} icon={<Icon.Trophy />} active={isActive(`${base}/trophies`)} color="var(--neon-amber)">
        Trophies
      </NavLink>

      {/* ascnd points widget */}
      <div className="mx-2 mt-3 flex items-center gap-2.5 px-3 py-2.5" style={{ border: "1px solid color-mix(in srgb, var(--neon-cyan) 18%, transparent)", background: "color-mix(in srgb, var(--neon-cyan) 6%, transparent)" }}>
        <span style={{ color: "var(--neon-cyan)" }}>
          <Icon.AscndPoints />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold tabular-nums" style={{ color: "var(--neon-cyan)" }}>
            {currencyBalance.toLocaleString()}
          </p>
          <p className="text-[10px] uppercase tracking-widest text-gray-700">ascnd points</p>
        </div>
      </div>

      {isMentor && (
        <>
          <SidebarSection label="Management" />
          <NavLink href={`${base}/admin`} icon={<Icon.Shield />} active={isActive(`${base}/admin`)} color="var(--text-1)">
            Management
          </NavLink>
        </>
      )}
    </>
  );
}
