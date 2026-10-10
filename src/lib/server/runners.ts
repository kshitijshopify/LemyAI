import type { AnyReport } from "@/lib/report-types";
import { runCroAudit } from "./tools/cro";
import { runSpeedAudit } from "./tools/speed";
import { runStackDetector } from "./tools/stack";

export type Runner = (input: { url: string }) => Promise<AnyReport>;

/** Maps a tool slug from tools.config.ts to its server-side runner. */
export const RUNNERS: Record<string, Runner> = {
  "pdp-cro-audit": runCroAudit,
  "speed-audit": runSpeedAudit,
  "store-stack-detector": runStackDetector,
};
