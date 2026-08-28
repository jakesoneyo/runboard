import { useUpdateRunStatus } from "../../features/runs/hooks";
import { useUiStore } from "../../stores/ui-store";
import { getErrorMessage } from "../../lib/errors";
import { Button } from "../ui/Button";
import type { RunStatus } from "../../types/api";

const TERMINAL: readonly RunStatus[] = ["COMPLETED", "ABORTED"];

/** API.md 5장 상태 전이 — QA_LEAD+ 전용, 종료 상태에서는 아무 버튼도 보여주지 않는다. */
export function RunStatusControls({
  runId,
  status,
}: {
  runId: string;
  status: RunStatus;
}) {
  const updateStatus = useUpdateRunStatus(runId);
  const showToast = useUiStore((s) => s.showToast);

  if (TERMINAL.includes(status)) return null;

  function change(next: "IN_PROGRESS" | "COMPLETED" | "ABORTED") {
    updateStatus.mutate(next, {
      onError: (error) => showToast(getErrorMessage(error)),
    });
  }

  return (
    <div className="flex flex-none gap-2">
      {status === "PLANNED" && (
        <Button
          variant="accent"
          disabled={updateStatus.isPending}
          onClick={() => change("IN_PROGRESS")}
        >
          실행 시작
        </Button>
      )}
      {status === "IN_PROGRESS" && (
        <Button
          variant="primary"
          disabled={updateStatus.isPending}
          onClick={() => change("COMPLETED")}
        >
          완료 처리
        </Button>
      )}
      <Button
        variant="outline"
        disabled={updateStatus.isPending}
        onClick={() => change("ABORTED")}
      >
        중단
      </Button>
    </div>
  );
}
