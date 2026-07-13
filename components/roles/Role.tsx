import type { EventRole } from "@prisma/client";
import { ROLE_META } from "@/lib/roles";

/** Rank chevrons that sit on the insignia — more pips = higher rank. */
function Pips({ n, color }: { n: number; color: string }) {
  if (n === 0) {
    // Intendant: a diamond instead of chevrons (support, off the combat ladder)
    return <span style={{ color }}>◆</span>;
  }
  return (
    <span style={{ color, letterSpacing: "-2px" }}>{"›".repeat(n)}</span>
  );
}

/** Portrait with a role-coloured frame + a rank insignia corner.
 *  Chosen over a plain icon because the Necromancers template leans on
 *  team-coloured framed portraits — this reads instantly "in-game rank". */
export function RolePortrait({
  initials,
  role,
  fallbackColor = "#7C4DFF",
  size = 56,
  leader = false,
}: {
  initials: string;
  role?: EventRole | null;
  fallbackColor?: string;
  size?: number;
  leader?: boolean;
}) {
  const color = role ? ROLE_META[role].color : fallbackColor;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <div
        className="grid h-full w-full place-items-center font-display font-bold uppercase text-white"
        style={{
          background: "#1B1826",
          border: `2px solid ${color}`,
          boxShadow: `0 0 14px -4px ${color}`,
          fontSize: size * 0.34,
        }}
      >
        {initials}
      </div>
      {/* Rank insignia corner */}
      {role && (
        <div
          className="absolute -bottom-1.5 -right-1.5 flex h-4 items-center px-1 font-nav text-[0.6rem] font-bold leading-none -skew-x-[20deg]"
          style={{ background: color, color: "#12101A" }}
          title={ROLE_META[role].label}
        >
          <span className="skew-x-[20deg]">
            <Pips n={ROLE_META[role].pips} color="#12101A" />
          </span>
        </div>
      )}
      {leader && (
        <div
          className="absolute -top-2 left-1/2 -translate-x-1/2 font-display text-sm"
          title="Seigneur — chef d'équipe"
        >
          👑
        </div>
      )}
    </div>
  );
}

/** Inline role chip with rank colour. */
export function RoleBadge({ role }: { role?: EventRole | null }) {
  if (!role) {
    return (
      <span className="badge border-hair text-ink-faint">Sans rôle</span>
    );
  }
  const m = ROLE_META[role];
  return (
    <span
      className="badge"
      style={{ borderColor: `${m.color}80`, color: m.color, background: `${m.color}14` }}
    >
      <Pips n={m.pips} color={m.color} />
      {m.label}
    </span>
  );
}
