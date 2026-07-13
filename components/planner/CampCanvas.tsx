"use client";

import { useRef } from "react";
import { Stage, Layer, Line, Rect, Circle, Wedge, Text, Group } from "react-konva";
import type Konva from "konva";
import type { LayoutConfig, PlacedToken } from "@/lib/planner/types";

interface Props {
  layout: LayoutConfig;
  tokens: PlacedToken[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onMove: (id: string, xM: number, yM: number) => void;
  onToggleRope: (id: string) => void;
  onDropGear: (gearId: string, xM: number, yM: number) => void;
}

// Half-extent of a token in meters, used for bounds clamping + label sizing.
function halfExtentM(t: PlacedToken): { hw: number; hh: number } {
  const rope = t.showRopeZone ? t.ropeZoneRadiusM : 0;
  if (t.shape === "ROUND") {
    const r = (t.diameterM ?? 1) / 2 + rope;
    return { hw: r, hh: r };
  }
  return {
    hw: (t.widthM ?? 1) / 2 + rope,
    hh: (t.lengthM ?? 1) / 2 + rope,
  };
}

export default function CampCanvas({
  layout,
  tokens,
  selectedId,
  onSelect,
  onMove,
  onToggleRope,
  onDropGear,
}: Props) {
  const { widthM, heightM, pixelsPerMeter: ppm } = layout;
  const wpx = widthM * ppm;
  const hpx = heightM * ppm;
  const containerRef = useRef<HTMLDivElement>(null);

  // --- Grid lines (every 1m, emphasized every 5m) ---
  const grid: React.ReactNode[] = [];
  for (let m = 0; m <= widthM; m++) {
    const strong = m % 5 === 0;
    grid.push(
      <Line
        key={`v${m}`}
        points={[m * ppm, 0, m * ppm, hpx]}
        stroke={strong ? "#2E2842" : "#241F33"}
        strokeWidth={strong ? 1.5 : 1}
      />
    );
    if (strong && m > 0 && m < widthM) {
      grid.push(<Text key={`vl${m}`} x={m * ppm + 2} y={2} text={`${m}m`} fontSize={10} fill="#6E6788" />);
    }
  }
  for (let m = 0; m <= heightM; m++) {
    const strong = m % 5 === 0;
    grid.push(
      <Line
        key={`h${m}`}
        points={[0, m * ppm, wpx, m * ppm]}
        stroke={strong ? "#2E2842" : "#241F33"}
        strokeWidth={strong ? 1.5 : 1}
      />
    );
    if (strong && m > 0 && m < heightM) {
      grid.push(<Text key={`hl${m}`} x={2} y={m * ppm + 2} text={`${m}m`} fontSize={10} fill="#6E6788" />);
    }
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const gearId = e.dataTransfer.getData("text/gear");
    if (!gearId) return;
    const box = containerRef.current?.getBoundingClientRect();
    if (!box) return;
    const px = e.clientX - box.left + (containerRef.current?.scrollLeft ?? 0);
    const py = e.clientY - box.top + (containerRef.current?.scrollTop ?? 0);
    onDropGear(gearId, px / ppm, py / ppm);
  }

  return (
    <div
      ref={containerRef}
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      className="max-h-[calc(100vh-2rem)] max-w-full overflow-auto rounded-none border border-hair shadow-inner"
      style={{ width: "fit-content" }}
    >
      <Stage
        width={wpx}
        height={hpx}
        onMouseDown={(e) => {
          if (e.target === e.target.getStage()) onSelect(null);
        }}
      >
        <Layer listening={false}>
          <Rect x={0} y={0} width={wpx} height={hpx} fill="#1B1826" />
          {grid}
        </Layer>

        <Layer>
          {tokens.map((t) => {
            const selected = t.id === selectedId;
            const { hw, hh } = halfExtentM(t);
            const isRound = t.shape === "ROUND";
            const R = ((t.diameterM ?? 1) / 2) * ppm;
            const wPx = (t.widthM ?? 1) * ppm;
            const lPx = (t.lengthM ?? 1) * ppm;
            const ropePx = t.ropeZoneRadiusM * ppm;

            return (
              <Group
                key={t.id}
                x={t.xM * ppm}
                y={t.yM * ppm}
                rotation={t.rotation}
                draggable
                onClick={() => onSelect(t.id)}
                onTap={() => onSelect(t.id)}
                onDragStart={() => onSelect(t.id)}
                onDragEnd={(e: Konva.KonvaEventObject<DragEvent>) => {
                  // Clamp center so the token (incl. rope zone) stays on the grid.
                  const nx = Math.min(Math.max(e.target.x() / ppm, hw), widthM - hw);
                  const ny = Math.min(Math.max(e.target.y() / ppm, hh), heightM - hh);
                  e.target.position({ x: nx * ppm, y: ny * ppm });
                  onMove(t.id, nx, ny);
                }}
              >
                {/* Rope zone (translucent outer boundary) */}
                {t.showRopeZone &&
                  (isRound ? (
                    <Circle
                      radius={R + ropePx}
                      fill={t.color}
                      opacity={0.18}
                      stroke={t.color}
                      strokeWidth={1}
                      dash={[6, 4]}
                    />
                  ) : (
                    <Rect
                      width={wPx + ropePx * 2}
                      height={lPx + ropePx * 2}
                      offsetX={wPx / 2 + ropePx}
                      offsetY={lPx / 2 + ropePx}
                      cornerRadius={ropePx}
                      fill={t.color}
                      opacity={0.18}
                      stroke={t.color}
                      strokeWidth={1}
                      dash={[6, 4]}
                    />
                  ))}

                {/* Main body */}
                {isRound ? (
                  t.segments && t.segments.length > 0 ? (
                    (() => {
                      // Always equal parts: each segment gets 360° / count.
                      const angle = 360 / t.segments.length;
                      let acc = -90; // start at top
                      return t.segments.map((seg, i) => {
                        const wedge = (
                          <Wedge
                            key={i}
                            radius={R}
                            angle={angle}
                            rotation={acc}
                            fill={seg.color}
                            opacity={0.8}
                            stroke="#2E2842"
                            strokeWidth={0.5}
                          />
                        );
                        acc += angle;
                        return wedge;
                      });
                    })()
                  ) : (
                    <Circle
                      radius={R}
                      fill={t.color}
                      opacity={0.7}
                      stroke={selected ? "#7C4DFF" : "#2E2842"}
                      strokeWidth={selected ? 3 : 1.5}
                    />
                  )
                ) : (
                  <Rect
                    width={wPx}
                    height={lPx}
                    offsetX={wPx / 2}
                    offsetY={lPx / 2}
                    fill={t.color}
                    opacity={0.7}
                    stroke={selected ? "#7C4DFF" : "#2E2842"}
                    strokeWidth={selected ? 3 : 1.5}
                  />
                )}

                {/* Selection ring for segmented/round bodies */}
                {selected && isRound && t.segments && t.segments.length > 0 && (
                  <Circle radius={R} stroke="#7C4DFF" strokeWidth={3} />
                )}

                {/* Label */}
                <Text
                  text={t.label}
                  fontSize={11}
                  fontStyle="bold"
                  fill="#E6E3F0"
                  width={Math.max(isRound ? R * 2 : wPx, 60)}
                  offsetX={Math.max(isRound ? R : wPx / 2, 30)}
                  align="center"
                  y={-6}
                />

                {/* On-canvas rope toggle for the selected token */}
                {selected && (
                  <Group
                    y={-hh * ppm - 18}
                    onClick={(e) => {
                      e.cancelBubble = true;
                      onToggleRope(t.id);
                    }}
                    onTap={(e) => {
                      e.cancelBubble = true;
                      onToggleRope(t.id);
                    }}
                  >
                    <Rect
                      width={112}
                      height={22}
                      offsetX={56}
                      cornerRadius={11}
                      fill={t.showRopeZone ? "#7C4DFF" : "#3A3550"}
                    />
                    <Text
                      text={t.showRopeZone ? "◉ Cordage ON" : "○ Cordage OFF"}
                      fontSize={11}
                      fill="#fff"
                      width={112}
                      offsetX={56}
                      align="center"
                      y={5}
                    />
                  </Group>
                )}
              </Group>
            );
          })}
        </Layer>
      </Stage>
    </div>
  );
}
