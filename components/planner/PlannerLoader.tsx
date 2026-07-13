"use client";

import dynamic from "next/dynamic";
import type { CampPlannerProps } from "./CampPlanner";

// Konva touches `window`/`canvas`, so the planner must not server-render.
const CampPlanner = dynamic(() => import("./CampPlanner"), {
  ssr: false,
  loading: () => (
    <div className="grid h-screen place-items-center bg-base font-nav uppercase tracking-wider text-ink-soft">
      Chargement du planificateur…
    </div>
  ),
});

export default function PlannerLoader(props: CampPlannerProps) {
  return <CampPlanner {...props} />;
}
