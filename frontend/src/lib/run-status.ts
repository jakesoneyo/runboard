import type { RunStatus } from "../types/api";
import type { BadgeTone } from "../components/ui/Badge";

/** 실행 상태별 배지 톤 — variant-c-bold의 결과 세맨틱 컬러를 상태 표시에도 재사용한다(컬러락). */
export const RUN_STATUS_TONE: Record<RunStatus, BadgeTone> = {
  PLANNED: "skip",
  IN_PROGRESS: "accent",
  COMPLETED: "pass",
  ABORTED: "fail",
};

export const RUN_STATUS_LABEL: Record<RunStatus, string> = {
  PLANNED: "PLANNED",
  IN_PROGRESS: "IN_PROGRESS",
  COMPLETED: "COMPLETED",
  ABORTED: "ABORTED",
};
