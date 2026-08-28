import type { KeyboardEvent } from "react";
import { useRecordResult } from "../../features/runs/hooks";
import { useUiStore } from "../../stores/ui-store";
import { getErrorMessage } from "../../lib/errors";
import type { RunCaseItem, RunCaseResult } from "../../types/api";

const RESULT_BUTTONS: { result: RunCaseResult; label: string; key: string }[] =
  [
    { result: "PASS", label: "PASS", key: "p" },
    { result: "FAIL", label: "FAIL", key: "f" },
    { result: "BLOCKED", label: "BLOCKED", key: "b" },
    { result: "SKIPPED", label: "SKIP", key: "s" },
  ];

const ACTIVE_CLASS: Record<RunCaseResult, string> = {
  PENDING: "",
  PASS: "border-pass bg-pass text-white",
  FAIL: "border-fail bg-fail text-white",
  BLOCKED: "border-blocked bg-blocked text-white",
  SKIPPED: "border-skip bg-skip text-white",
};

/**
 * variant-c-bold .exec-row — 케이스 한 줄 + P/F/B/S 결과 버튼. 단축키(P/F/B/S)는 이 행에
 * 포커스가 있을 때만 반응한다(전역 리스너로 만들면 다른 입력 필드에서도 오작동하기 쉽다).
 */
export function ExecCaseRow({
  runId,
  caseItem,
  disabled,
  onFailRecorded,
}: {
  runId: string;
  caseItem: RunCaseItem;
  disabled: boolean;
  onFailRecorded: (runCaseId: string) => void;
}) {
  const recordResult = useRecordResult(runId);
  const showToast = useUiStore((s) => s.showToast);

  function record(result: RunCaseResult) {
    if (disabled || recordResult.isPending) return;
    recordResult.mutate(
      { runCaseId: caseItem.id, result },
      {
        onSuccess: () => {
          if (result === "FAIL") onFailRecorded(caseItem.id);
        },
        onError: (error) => showToast(getErrorMessage(error)),
      }
    );
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const match = RESULT_BUTTONS.find((b) => b.key === event.key.toLowerCase());
    if (match) {
      event.preventDefault();
      record(match.result);
    }
  }

  return (
    <div
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className="mb-[-1.5px] flex items-center gap-3.5 border-[1.5px] border-ink bg-paper-raised px-5 py-4 focus:z-10 focus:outline-2 focus:outline-accent focus:outline-offset-[-2px]"
    >
      <span className="w-14 flex-none text-[10.5px] text-ink/40">
        #{caseItem.position + 1}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-semibold">
          {caseItem.title}
        </div>
        {caseItem.recordedBy && (
          <div className="text-[10.5px] text-ink/45">
            {caseItem.recordedBy.name ?? "기록됨"} 기록
          </div>
        )}
      </div>
      <div className="flex flex-none gap-1.5">
        {RESULT_BUTTONS.map((b) => (
          <button
            key={b.result}
            type="button"
            disabled={disabled}
            onClick={() => record(b.result)}
            title={`단축키: ${b.key.toUpperCase()}`}
            className={`border-[1.5px] px-2.5 py-1.5 text-[10.5px] font-extrabold tracking-[0.02em] transition hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-40 ${
              caseItem.result === b.result
                ? ACTIVE_CLASS[b.result]
                : "border-paper-line-strong bg-white text-ink/60"
            }`}
          >
            {b.label}
          </button>
        ))}
      </div>
    </div>
  );
}
