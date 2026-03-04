"use client";

import { useState, useTransition } from "react";
import { updateAvatar } from "@/actions/profile";
import { dicebearUrl, type AvatarOptions } from "@/lib/dicebear";

// ── Option arrays ─────────────────────────────────────────────────────────────
const pad = (n: number) => String(n).padStart(2, "0");
const arr = (count: number, prefix: string) =>
  Array.from({ length: count }, (_, i) => `${prefix}${pad(i + 1)}`);

const HAIR     = arr(48, "variant");
const HEAD     = arr(4,  "variant");
const EYES     = arr(24, "variant");
const MOUTH    = [...arr(18, "happy"), ...arr(9, "sad")];
const EYEBROWS = arr(13, "variant");
const NOSE     = arr(6,  "variant");
const GLASSES  = ["none", ...arr(5, "variant")];
const OFFSETS  = [-50, -40, -30, -20, -10, 0, 10, 20, 30, 40, 50];

const SKIN_COLORS = [
  "fde8d4", "f5cba7", "e8b899", "d4885a",
  "c07a50", "a06040", "7a4520", "4a2512",
];

const BG_COLORS = [
  "0b1020", "0d1b2a", "1e1b4b", "2e1065",
  "042f2e", "052e16", "4c0519", "0f172a",
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function cycle<T>(list: T[], current: T | undefined, dir: 1 | -1): T {
  const i = current !== undefined ? list.indexOf(current) : -1;
  return list[((i === -1 ? 0 : i) + dir + list.length) % list.length];
}

function cycleNum(list: number[], current: number | undefined, dir: 1 | -1): number {
  const idx = current !== undefined ? list.indexOf(current) : list.indexOf(0);
  return list[((idx === -1 ? list.indexOf(0) : idx) + dir + list.length) % list.length];
}

function strLabel(list: string[], val: string | undefined, fmt: (v: string, i: number) => string) {
  if (val === undefined) return "random";
  const i = list.indexOf(val);
  return i === -1 ? "random" : fmt(val, i);
}

function numLabel(val: number | undefined) {
  const v = val ?? 0;
  return v > 0 ? `+${v}` : `${v}`;
}

// ── Sub-components ────────────────────────────────────────────────────────────
function CycleRow({
  label,
  display,
  onPrev,
  onNext,
}: {
  label: string;
  display: string;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex items-center justify-between py-[3px]">
      <span className="text-[11px] text-gray-500">{label}</span>
      <div className="flex items-center">
        <button
          type="button"
          onClick={onPrev}
          className="flex h-6 w-6 items-center justify-center rounded text-gray-600 hover:bg-white/[0.06] hover:text-gray-300 transition-colors text-base leading-none"
        >
          ‹
        </button>
        <span className="w-[68px] text-center text-[11px] text-white tabular-nums">{display}</span>
        <button
          type="button"
          onClick={onNext}
          className="flex h-6 w-6 items-center justify-center rounded text-gray-600 hover:bg-white/[0.06] hover:text-gray-300 transition-colors text-base leading-none"
        >
          ›
        </button>
      </div>
    </div>
  );
}

function SwatchRow({
  label,
  colors,
  value,
  onChange,
  round,
}: {
  label: string;
  colors: string[];
  value: string | undefined;
  onChange: (hex: string) => void;
  round?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-[3px]">
      <span className="text-[11px] text-gray-500 shrink-0">{label}</span>
      <div className="flex flex-wrap gap-1.5 justify-end">
        {colors.map((hex) => (
          <button
            key={hex}
            type="button"
            onClick={() => onChange(hex)}
            className={`h-5 w-5 transition-transform hover:scale-110 ${round ? "rounded-full" : "rounded-sm"}`}
            style={{
              background: `#${hex}`,
              outline: value === hex
                ? "2px solid color-mix(in srgb, var(--neon-cyan) 80%, transparent)"
                : "1px solid rgba(255,255,255,0.12)",
              outlineOffset: value === hex ? "1px" : "0px",
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function AvatarCustomizer({
  initialSeed,
  initialBg,
  initialOpts = {},
}: {
  initialSeed: string;
  initialBg: string;
  initialOpts?: AvatarOptions;
}) {
  const [seed, setSeed]   = useState(initialSeed);
  const [bg, setBg]       = useState(initialBg);
  const [opts, setOpts]   = useState<AvatarOptions>(initialOpts);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const previewUrl = dicebearUrl(seed, bg, 160, opts);

  function upd(partial: Partial<AvatarOptions>) {
    setOpts((o) => ({ ...o, ...partial }));
    setSaved(false);
  }

  function randomize() {
    setSeed(Math.random().toString(36).slice(2, 10));
    setOpts({});
    setSaved(false);
  }

  function handleSave() {
    setError("");
    setSaved(false);
    startTransition(async () => {
      const res = await updateAvatar(seed, bg, opts);
      if ("error" in res) setError(res.error);
      else setSaved(true);
    });
  }

  return (
    <div className="card p-5 space-y-4">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-500">
        Customize Avatar
      </p>

      {/* Preview */}
      <div className="flex justify-center">
        <div
          className="flex h-32 w-32 items-center justify-center overflow-hidden rounded-full"
          style={{
            background: `#${bg}`,
            border: "1px solid color-mix(in srgb, var(--neon-cyan) 25%, transparent)",
            boxShadow: "0 0 20px color-mix(in srgb, var(--neon-cyan) 8%, transparent)",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewUrl} alt="Avatar preview" className="h-28 w-28" />
        </div>
      </div>

      {/* Feature rows — ordered: head, hair, eyebrows, eyes, nose, mouth, glasses, offsets, flip */}
      <div className="divide-y divide-white/[0.04]">
        <div className="pb-2 space-y-0">
          <CycleRow
            label="Head"
            display={strLabel(HEAD, opts.head, (_, i) => `${i + 1} / 4`)}
            onPrev={() => upd({ head: cycle(HEAD, opts.head, -1) })}
            onNext={() => upd({ head: cycle(HEAD, opts.head, 1) })}
          />
          <CycleRow
            label="Hair"
            display={strLabel(HAIR, opts.hair, (_, i) => `${i + 1} / 48`)}
            onPrev={() => upd({ hair: cycle(HAIR, opts.hair, -1) })}
            onNext={() => upd({ hair: cycle(HAIR, opts.hair, 1) })}
          />
          <CycleRow
            label="Eyebrows"
            display={strLabel(EYEBROWS, opts.eyebrows, (_, i) => `${i + 1} / 13`)}
            onPrev={() => upd({ eyebrows: cycle(EYEBROWS, opts.eyebrows, -1) })}
            onNext={() => upd({ eyebrows: cycle(EYEBROWS, opts.eyebrows, 1) })}
          />
          <CycleRow
            label="Eyes"
            display={strLabel(EYES, opts.eyes, (_, i) => `${i + 1} / 24`)}
            onPrev={() => upd({ eyes: cycle(EYES, opts.eyes, -1) })}
            onNext={() => upd({ eyes: cycle(EYES, opts.eyes, 1) })}
          />
          <CycleRow
            label="Nose"
            display={strLabel(NOSE, opts.nose, (_, i) => `${i + 1} / 6`)}
            onPrev={() => upd({ nose: cycle(NOSE, opts.nose, -1) })}
            onNext={() => upd({ nose: cycle(NOSE, opts.nose, 1) })}
          />
          <CycleRow
            label="Mouth"
            display={strLabel(MOUTH, opts.mouth, (v) => {
              if (v.startsWith("happy")) return `happy ${+v.slice(5)}`;
              if (v.startsWith("sad"))   return `sad ${+v.slice(3)}`;
              return v;
            })}
            onPrev={() => upd({ mouth: cycle(MOUTH, opts.mouth, -1) })}
            onNext={() => upd({ mouth: cycle(MOUTH, opts.mouth, 1) })}
          />
          <CycleRow
            label="Glasses"
            display={strLabel(GLASSES, opts.glasses, (v, i) =>
              v === "none" ? "none" : `style ${i}`
            )}
            onPrev={() => upd({ glasses: cycle(GLASSES, opts.glasses, -1) })}
            onNext={() => upd({ glasses: cycle(GLASSES, opts.glasses, 1) })}
          />
        </div>

        <div className="py-2 space-y-0">
          <CycleRow
            label="Offset X"
            display={numLabel(opts.translateX)}
            onPrev={() => upd({ translateX: cycleNum(OFFSETS, opts.translateX, -1) })}
            onNext={() => upd({ translateX: cycleNum(OFFSETS, opts.translateX, 1) })}
          />
          <CycleRow
            label="Offset Y"
            display={numLabel(opts.translateY)}
            onPrev={() => upd({ translateY: cycleNum(OFFSETS, opts.translateY, -1) })}
            onNext={() => upd({ translateY: cycleNum(OFFSETS, opts.translateY, 1) })}
          />
          {/* Flip toggle */}
          <div className="flex items-center justify-between py-[3px]">
            <span className="text-[11px] text-gray-500">Flip</span>
            <button
              type="button"
              onClick={() => upd({ flip: !opts.flip })}
              className="h-6 rounded px-3 text-[11px] transition-colors"
              style={
                opts.flip
                  ? {
                      background: "color-mix(in srgb, var(--neon-cyan) 12%, transparent)",
                      color: "var(--neon-cyan)",
                      border: "1px solid color-mix(in srgb, var(--neon-cyan) 40%, transparent)",
                    }
                  : {
                      background: "transparent",
                      color: "rgb(107,114,128)",
                      border: "1px solid rgba(255,255,255,0.1)",
                    }
              }
            >
              {opts.flip ? "on" : "off"}
            </button>
          </div>
        </div>

        <div className="pt-2 space-y-2">
          <SwatchRow
            label="Skin"
            colors={SKIN_COLORS}
            value={opts.skinColor}
            onChange={(hex) => upd({ skinColor: hex })}
            round
          />
          <SwatchRow
            label="Background"
            colors={BG_COLORS}
            value={bg}
            onChange={(hex) => { setBg(hex); setSaved(false); }}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button type="button" onClick={randomize} className="btn btn-ghost btn-sm flex-1">
          Randomize
        </button>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}
      <button
        type="button"
        onClick={handleSave}
        disabled={isPending}
        className="btn btn-primary w-full"
      >
        {isPending ? "Saving…" : saved ? "Saved!" : "Save avatar"}
      </button>
    </div>
  );
}
