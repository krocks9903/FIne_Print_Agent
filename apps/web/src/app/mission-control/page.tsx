import { notFound } from "next/navigation";
import { MissionControl } from "@/mission-control/MissionControl";

export default function MissionControlPage() {
  // The global feed includes other users' scan metadata; do not expose it publicly.
  if (process.env.NODE_ENV !== "development") notFound();
  return <MissionControl />;
}
