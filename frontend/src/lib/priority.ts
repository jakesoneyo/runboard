import type { CasePriority } from "../types/api";
import type { BadgeTone } from "../components/ui/Badge";

/** variant-c-bold 목업의 P0~P3 배지 색 위계(critical=fail색 ~ low=skip색)를 그대로 재사용한다. */
export const PRIORITY_TONE: Record<CasePriority, BadgeTone> = {
  CRITICAL: "fail",
  HIGH: "blocked",
  MEDIUM: "accent",
  LOW: "skip",
};

export const PRIORITY_LABEL: Record<CasePriority, string> = {
  CRITICAL: "CRITICAL",
  HIGH: "HIGH",
  MEDIUM: "MEDIUM",
  LOW: "LOW",
};
