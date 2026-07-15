// Top-view schematic of a tent — the same visual language as the camp planner
// (translucent rope zone + equal-part coloured pie segments for round tents),
// rendered as a static SVG so it works anywhere (no canvas / no interactivity).

import { DEFAULT_TENT_COLOR, type TentShapeValue } from "@/lib/camp-gear";

export interface TentTopViewProps {
  shape: TentShapeValue;
  diameterM?: number | null;
  widthM?: number | null;
  lengthM?: number | null;
  ropeZoneRadiusM?: number | null;
  color?: string | null;
  segments?: string[]; // hex colours; 2+ => pie livery on round tents
  size?: number; // rendered px (square), default 96
  showRope?: boolean; // default: true when rope radius > 0
}

function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
  const a = (deg * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

export default function TentTopView({
  shape,
  diameterM,
  widthM,
  lengthM,
  ropeZoneRadiusM,
  color,
  segments = [],
  size = 96,
  showRope,
}: TentTopViewProps) {
  const base = color || DEFAULT_TENT_COLOR;
  const round = shape === "ROUND";
  const rope = Math.max(0, ropeZoneRadiusM ?? 0);
  const withRope = (showRope ?? rope > 0) && rope > 0;

  // Work in meters, centered on (0,0); the viewBox scales it to `size`.
  const R = round ? (diameterM ?? 1) / 2 : 0;
  const w = widthM ?? 1;
  const l = lengthM ?? 1;
  const halfW = round ? R + (withRope ? rope : 0) : w / 2 + (withRope ? rope : 0);
  const halfH = round ? R + (withRope ? rope : 0) : l / 2 + (withRope ? rope : 0);
  const ext = Math.max(halfW, halfH, 0.5);
  const sw = ext * 0.018; // stroke width, proportional
  const dash = `${ext * 0.05} ${ext * 0.035}`;

  const clean = segments.filter(Boolean);
  const pie = round && clean.length >= 2;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`${-ext} ${-ext} ${2 * ext} ${2 * ext}`}
      role="img"
      aria-label="Vue de dessus de la tente"
    >
      {/* Rope zone */}
      {withRope &&
        (round ? (
          <circle
            cx={0}
            cy={0}
            r={R + rope}
            fill={base}
            fillOpacity={0.18}
            stroke={base}
            strokeWidth={sw}
            strokeDasharray={dash}
          />
        ) : (
          <rect
            x={-(w / 2 + rope)}
            y={-(l / 2 + rope)}
            width={w + rope * 2}
            height={l + rope * 2}
            rx={rope}
            fill={base}
            fillOpacity={0.18}
            stroke={base}
            strokeWidth={sw}
            strokeDasharray={dash}
          />
        ))}

      {/* Body */}
      {round ? (
        pie ? (
          <>
            {clean.map((segColor, i) => {
              const angle = 360 / clean.length;
              const a0 = -90 + i * angle;
              const a1 = a0 + angle;
              const [x0, y0] = polar(0, 0, R, a0);
              const [x1, y1] = polar(0, 0, R, a1);
              const largeArc = angle > 180 ? 1 : 0;
              return (
                <path
                  key={i}
                  d={`M 0 0 L ${x0} ${y0} A ${R} ${R} 0 ${largeArc} 1 ${x1} ${y1} Z`}
                  fill={segColor}
                  fillOpacity={0.85}
                  stroke="#2E2842"
                  strokeWidth={sw * 0.6}
                />
              );
            })}
            <circle cx={0} cy={0} r={R} fill="none" stroke="#2E2842" strokeWidth={sw} />
          </>
        ) : (
          <circle
            cx={0}
            cy={0}
            r={R}
            fill={base}
            fillOpacity={0.8}
            stroke="#2E2842"
            strokeWidth={sw}
          />
        )
      ) : (
        <rect
          x={-w / 2}
          y={-l / 2}
          width={w}
          height={l}
          fill={base}
          fillOpacity={0.8}
          stroke="#2E2842"
          strokeWidth={sw}
        />
      )}
    </svg>
  );
}
