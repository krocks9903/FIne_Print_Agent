import type { DeadlineItem } from "@/lib/deadlines";
import type { ViewFinding } from "@/lib/findings";
import type { PageRef } from "@/lib/nav";

export interface ViewProps {
  scanId: string;
  /** content_sha256 of the document; keeps calendar events per document. */
  docHash: string;
  fileName: string;
  noun: "lease" | "contract";
  findings: ViewFinding[];
  deadlines: DeadlineItem[];
  cacheHit: boolean;
  /** Pages that could not be read, so were not scanned. */
  unreadable: number[];
  onOpen: (ref: PageRef) => void;
  onView: (view: import("../NavIcons").ViewId) => void;
}
