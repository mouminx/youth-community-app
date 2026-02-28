/**
 * scripts/seed-test-users.mjs
 *
 * Creates 5 test accounts + a fully-populated "dev-club" community.
 * Uses the service role key (bypasses RLS).
 *
 * Usage:
 *   npm run seed            # seed (skips if dev-club already exists)
 *   npm run seed -- --reset # wipe dev-club and re-seed from scratch
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

// ── Read .env.local ────────────────────────────────────────────────────────────
function loadEnv() {
  const content = readFileSync(resolve(process.cwd(), ".env.local"), "utf-8");
  return Object.fromEntries(
    content
      .split("\n")
      .filter((line) => line.trim() && !line.startsWith("#"))
      .map((line) => {
        const [key, ...rest] = line.split("=");
        return [key.trim(), rest.join("=").trim()];
      })
  );
}

const env = loadEnv();
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── Config ─────────────────────────────────────────────────────────────────────
const RESET = process.argv.includes("--reset");
const COMMUNITY_SLUG = "dev-club";
const TEST_PASSWORD = "Test1234!";

const TEST_USERS = [
  { email: "owner@test.dev",   name: "Alex Chen",    role: "owner"  },
  { email: "admin@test.dev",   name: "Jordan Lee",   role: "admin"  },
  { email: "mentor@test.dev",  name: "Sam Rivera",   role: "mentor" },
  { email: "member@test.dev",  name: "Casey Park",   role: "member" },
  { email: "member2@test.dev", name: "Riley Nguyen", role: "member" },
];

// ── Helpers ────────────────────────────────────────────────────────────────────
function daysAgo(n) {
  return new Date(Date.now() - n * 86_400_000).toISOString();
}
function daysFromNow(n) {
  return new Date(Date.now() + n * 86_400_000).toISOString();
}

async function getOrCreateUser(email, name) {
  // Check if user already exists
  const { data: { users } } = await supabase.auth.admin.listUsers({ perPage: 200 });
  const existing = users.find((u) => u.email === email);
  if (existing) {
    console.log(`  ↩ ${email} already exists`);
    return existing;
  }
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: { display_name: name },
  });
  if (error) throw new Error(`createUser(${email}): ${error.message}`);
  console.log(`  ✓ Created ${email}`);
  return data.user;
}

function assertNoError(error, context) {
  if (error) throw new Error(`${context}: ${error.message}`);
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  console.log("🌱 Seeding test data...\n");

  // ── Reset ──────────────────────────────────────────────────────────────────
  if (RESET) {
    console.log("⚠️  Resetting dev-club community...");
    const { data: existing } = await supabase
      .from("communities")
      .select("id")
      .eq("slug", COMMUNITY_SLUG)
      .maybeSingle();
    if (existing) {
      // Use the dev_reset_community RPC — it temporarily disables the
      // xp_no_delete trigger so the cascade delete can proceed.
      const { error } = await supabase.rpc("dev_reset_community", { _slug: COMMUNITY_SLUG });
      assertNoError(error, "dev_reset_community");
      console.log("  ✓ Deleted\n");
    } else {
      console.log("  – Nothing to delete\n");
    }
  }

  // ── Check if already seeded ────────────────────────────────────────────────
  const { data: existingCommunity } = await supabase
    .from("communities")
    .select("id")
    .eq("slug", COMMUNITY_SLUG)
    .maybeSingle();

  // ── Users (always ensure they exist) ──────────────────────────────────────
  console.log("👤 Ensuring test users exist...");
  const users = {};
  for (const u of TEST_USERS) {
    users[u.email] = await getOrCreateUser(u.email, u.name);
  }
  const [owner, admin, mentor, member, member2] = TEST_USERS.map((u) => users[u.email]);

  if (existingCommunity && !RESET) {
    console.log('\nℹ️  Community "dev-club" already exists. Run with --reset to re-seed.');
    printSummary();
    return;
  }

  // ── Community ──────────────────────────────────────────────────────────────
  console.log("\n🏘️  Creating community...");
  const { data: community, error: commErr } = await supabase
    .from("communities")
    .insert({ name: "Dev Youth Club", slug: COMMUNITY_SLUG, description: "Test community for local development", created_by: owner.id })
    .select("id, slug")
    .single();
  assertNoError(commErr, "create community");
  console.log(`  ✓ ${community.slug} (${community.id})`);

  // Bootstrap: owner membership + default channels
  const { error: bootErr } = await supabase.rpc("bootstrap_community", {
    _community_id: community.id,
    _user_id: owner.id,
  });
  assertNoError(bootErr, "bootstrap_community");
  console.log("  ✓ Owner membership + default channels created");

  // Other memberships
  const { error: memErr } = await supabase.from("memberships").insert([
    { community_id: community.id, user_id: admin.id,    role: "admin"  },
    { community_id: community.id, user_id: mentor.id,   role: "mentor" },
    { community_id: community.id, user_id: member.id,   role: "member" },
    { community_id: community.id, user_id: member2.id,  role: "member" },
  ]);
  assertNoError(memErr, "insert memberships");
  console.log("  ✓ 4 additional memberships added");

  // ── Season ─────────────────────────────────────────────────────────────────
  console.log("\n🏆 Creating season + battle pass tiers...");
  const { data: season, error: seasonErr } = await supabase
    .from("seasons")
    .insert({ community_id: community.id, name: "Spring 2026", starts_at: "2026-01-01T00:00:00Z", ends_at: "2026-06-30T23:59:59Z", is_active: true })
    .select("id")
    .single();
  assertNoError(seasonErr, "create season");

  const { error: tierErr } = await supabase.from("battle_pass_tiers").insert([
    { season_id: season.id, tier_number: 1, xp_required: 0,   reward_label: "Bronze Member"   },
    { season_id: season.id, tier_number: 2, xp_required: 75,  reward_label: "Silver Member"   },
    { season_id: season.id, tier_number: 3, xp_required: 150, reward_label: "Gold Member"     },
    { season_id: season.id, tier_number: 4, xp_required: 300, reward_label: "Platinum Member" },
    { season_id: season.id, tier_number: 5, xp_required: 500, reward_label: "Diamond Member"  },
  ]);
  assertNoError(tierErr, "create tiers");
  console.log("  ✓ Season 'Spring 2026' with 5 tiers");

  // ── Badges ─────────────────────────────────────────────────────────────────
  console.log("\n🎖️  Creating badges...");
  const { data: badges, error: badgeErr } = await supabase
    .from("badges")
    .insert([
      { community_id: community.id, name: "Early Bird",  description: "Attended the very first event"        },
      { community_id: community.id, name: "Team Player", description: "Always shows up and supports others"  },
      { community_id: community.id, name: "Top Scorer",  description: "Led the weekly leaderboard"           },
    ])
    .select("id, name");
  assertNoError(badgeErr, "create badges");
  const byName = Object.fromEntries(badges.map((b) => [b.name, b]));
  console.log(`  ✓ ${badges.length} badges`);

  // ── Events ─────────────────────────────────────────────────────────────────
  console.log("\n📅 Creating events...");
  const { data: events, error: eventErr } = await supabase
    .from("events")
    .insert([
      {
        community_id: community.id,
        title: "Community Kickoff",
        description: "Welcome meeting for all members — come introduce yourself!",
        location: "Youth Center, Room 101",
        start_time: daysAgo(14),
        created_by: owner.id,
      },
      {
        community_id: community.id,
        title: "Leadership Workshop",
        description: "Hands-on skills workshop for aspiring leaders.",
        location: "Online via Zoom",
        start_time: daysAgo(7),
        created_by: owner.id,
      },
      {
        community_id: community.id,
        title: "Spring Showcase",
        description: "Show off your projects and earn bonus XP!",
        location: "Main Hall, Building A",
        start_time: daysFromNow(7),
        end_time: daysFromNow(7.08), // ~2 hours later
        created_by: owner.id,
      },
    ])
    .select("id, title");
  assertNoError(eventErr, "create events");
  const [kickoff, workshop, showcase] = events;
  console.log(`  ✓ ${events.length} events (2 past, 1 upcoming)`);

  // ── Attendance (past events) ───────────────────────────────────────────────
  console.log("\n✅ Recording attendance...");

  // Kickoff: everyone attended
  const { data: kickoffAtt, error: k1Err } = await supabase
    .from("event_attendance")
    .insert([owner, admin, mentor, member, member2].map((u) => ({ event_id: kickoff.id, user_id: u.id, marked_by: mentor.id })))
    .select("id, user_id");
  assertNoError(k1Err, "kickoff attendance");

  // Workshop: owner, admin, mentor attended
  const { data: workshopAtt, error: k2Err } = await supabase
    .from("event_attendance")
    .insert([owner, admin, mentor].map((u) => ({ event_id: workshop.id, user_id: u.id, marked_by: mentor.id })))
    .select("id, user_id");
  assertNoError(k2Err, "workshop attendance");

  const allAttendance = [...kickoffAtt, ...workshopAtt];
  console.log(`  ✓ ${allAttendance.length} attendance records`);

  // RSVPs for upcoming showcase
  await supabase.from("event_rsvps").insert(
    [owner, admin, mentor, member, member2].map((u) => ({ event_id: showcase.id, user_id: u.id }))
  );
  console.log("  ✓ RSVPs added for Spring Showcase");

  // ── Badge awards ───────────────────────────────────────────────────────────
  console.log("\n🏅 Awarding badges...");
  const { data: badgeAwards, error: baErr } = await supabase
    .from("badge_awards")
    .insert([
      { community_id: community.id, badge_id: byName["Top Scorer"].id,  user_id: owner.id,  awarded_by: admin.id   },
      { community_id: community.id, badge_id: byName["Team Player"].id, user_id: admin.id,  awarded_by: mentor.id  },
      { community_id: community.id, badge_id: byName["Early Bird"].id,  user_id: mentor.id, awarded_by: mentor.id  },
    ])
    .select("id, user_id, awarded_by, badge_id");
  assertNoError(baErr, "badge awards");
  console.log(`  ✓ ${badgeAwards.length} badge awards`);

  // ── XP Ledger (split: claimed vs pending) ─────────────────────────────────
  console.log("\n⚡ Writing XP ledger (claimed + pending)...");

  // Strategy — each user showcases a different state when testing:
  //   Alex  (owner)  : all XP already claimed  → 150 total, nothing pending
  //   Jordan(admin)  : 1 attendance claimed     →  50 claimed, 75 pending (will unlock Tier 2 on claim)
  //   Sam   (mentor) : nothing claimed yet      →   0 claimed, 125 pending (will unlock Tier 1+2 on claim)
  //   Casey (member) : nothing claimed yet      →   0 claimed,  50 pending (will unlock Tier 1 on claim)
  //   Riley (member) : nothing claimed yet      →   0 claimed,  50 pending (will unlock Tier 1 on claim)

  const claimedAttendance = allAttendance.filter(
    (a) => a.user_id === owner.id || (a.user_id === admin.id && kickoffAtt.some((k) => k.id === a.id))
  );
  const pendingAttendance = allAttendance.filter((a) => !claimedAttendance.includes(a));

  const claimedBadges = badgeAwards.filter((b) => b.user_id === owner.id);
  const pendingBadges  = badgeAwards.filter((b) => b.user_id !== owner.id);

  const claimedXpRows = [
    ...claimedAttendance.map((a) => ({ community_id: community.id, user_id: a.user_id, season_id: season.id, amount: 50, reason: "attendance", reference_id: a.id })),
    ...claimedBadges.map((b)   => ({ community_id: community.id, user_id: b.user_id, season_id: season.id, amount: 25, reason: "badge_award", reference_id: b.id })),
    // Owner manual bonus
    { community_id: community.id, user_id: owner.id, season_id: season.id, amount: 25, reason: "manual" },
  ];

  const pendingXpRows = [
    ...pendingAttendance.map((a) => ({ community_id: community.id, user_id: a.user_id, season_id: season.id, amount: 50, reason: "attendance", reference_id: a.id })),
    ...pendingBadges.map((b)    => ({ community_id: community.id, user_id: b.user_id, season_id: season.id, amount: 25, reason: "badge_award", reference_id: b.id })),
  ];

  const { error: xpErr } = await supabase.from("xp_transactions").insert(claimedXpRows);
  assertNoError(xpErr, "xp_transactions");

  const { error: pendXpErr } = await supabase.from("pending_xp").insert(pendingXpRows);
  assertNoError(pendXpErr, "pending_xp");

  console.log(`  ✓ ${claimedXpRows.length} XP rows claimed, ${pendingXpRows.length} rows pending`);

  // Resulting state:
  //   Alex  (owner)  150 XP claimed, 0 pending
  //   Jordan(admin)   50 XP claimed, 75 pending  ← unlocks Tier 2 on claim
  //   Sam  (mentor)    0 XP claimed, 125 pending ← unlocks Tier 1+2 on claim
  //   Casey(member)    0 XP claimed, 50 pending  ← unlocks Tier 1 on claim
  //   Riley(member)    0 XP claimed, 50 pending  ← unlocks Tier 1 on claim

  // ── Audit log ──────────────────────────────────────────────────────────────
  await supabase.from("audit_log").insert(
    badgeAwards.map((b) => ({
      community_id: community.id,
      actor_id: b.awarded_by,
      action: "badge_awarded",
      target_user_id: b.user_id,
      metadata: { badge_id: b.badge_id },
    }))
  );

  console.log("\n✅ Seed complete!\n");
  printSummary();
}

function printSummary() {
  console.log("─────────────────────────────────────────────────────");
  console.log("Test accounts  (password: Test1234!)");
  console.log("─────────────────────────────────────────────────────");
  console.log("  owner@test.dev   → Alex Chen    [owner]   150 XP claimed, 0 pending");
  console.log("  admin@test.dev   → Jordan Lee   [admin]    50 XP claimed, 75 pending");
  console.log("  mentor@test.dev  → Sam Rivera   [mentor]    0 XP claimed, 125 pending");
  console.log("  member@test.dev  → Casey Park   [member]    0 XP claimed, 50 pending");
  console.log("  member2@test.dev → Riley Nguyen [member]    0 XP claimed, 50 pending");
  console.log("─────────────────────────────────────────────────────");
  console.log("  Community : http://localhost:3000/c/dev-club");
  console.log("─────────────────────────────────────────────────────");
}

main().catch((err) => {
  console.error("\n❌", err.message);
  process.exit(1);
});
