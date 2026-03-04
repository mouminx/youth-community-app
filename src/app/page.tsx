// Root page — middleware redirects logged-in users to /communities.
// Unauthenticated visitors see this landing page.
import Link from "next/link";

export default function Home() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6">

      {/* Decorative grid lines */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(rgba(59,232,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(59,232,255,0.04) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      {/* Radial vignette over the grid */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: "radial-gradient(ellipse 70% 60% at 50% 50%, transparent 30%, var(--bg-0) 100%)",
        }}
      />

      {/* Content */}
      <div className="relative flex flex-col items-center gap-8 text-center">

        {/* Wordmark */}
        <div className="flex flex-col items-center gap-3">
          <h1
            style={{
              fontFamily: "'Orbitron', sans-serif",
              fontWeight: 400,
              fontSize: "clamp(4rem, 14vw, 10rem)",
              letterSpacing: "0.08em",
              lineHeight: 1,
              textTransform: "lowercase",
              color: "#e8f8ff",
              textShadow:
                "0 0 18px rgba(59,232,255,0.9), 0 0 45px rgba(59,232,255,0.55), 0 0 90px rgba(59,232,255,0.25), 0 0 160px rgba(125,255,116,0.12)",
            }}
          >
            ascnd
          </h1>
          <p
            style={{
              fontFamily: "'Space Mono', monospace",
              fontSize: "0.7rem",
              letterSpacing: "0.35em",
              color: "rgba(59,232,255,0.55)",
              textTransform: "uppercase",
            }}
          >
            level up together
          </p>
        </div>

        {/* Divider */}
        <div
          style={{
            width: "120px",
            height: "1px",
            background: "linear-gradient(90deg, transparent, rgba(59,232,255,0.5), rgba(125,255,116,0.4), transparent)",
          }}
        />

        {/* Description */}
        <p
          className="max-w-sm text-sm leading-relaxed"
          style={{ color: "var(--text-1)", fontFamily: "'Funnel Display', sans-serif" }}
        >
          Community platform built for youth programs — XP, battle passes, badges, leaderboards, and real connection.
        </p>

        {/* CTAs */}
        <div className="flex items-center gap-4">
          <Link href="/login" className="btn-primary btn">
            Get started
          </Link>
          <Link href="/communities" className="btn-ghost btn">
            Browse communities
          </Link>
        </div>

        {/* Subtle feature tags */}
        <div className="flex flex-wrap justify-center gap-2">
          {["XP & Levels", "Battle Pass", "Leaderboards", "Badges", "Trophies", "Live Chat"].map((tag) => (
            <span
              key={tag}
              style={{
                fontFamily: "'Space Mono', monospace",
                fontSize: "0.6rem",
                letterSpacing: "0.12em",
                padding: "3px 10px",
                border: "1px solid rgba(59,232,255,0.15)",
                color: "rgba(59,232,255,0.4)",
                textTransform: "uppercase",
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
