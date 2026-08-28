import { useState } from "react";
import { useParams } from "react-router-dom";
import { useCurrentOrg } from "../features/orgs/hooks";
import { useRun, useRunCases } from "../features/runs/hooks";
import { useRunSocket } from "../features/runs/use-run-socket";
import { useAuthStore } from "../stores/auth-store";
import { roleAtLeast } from "../lib/roles";
import { RUN_STATUS_LABEL, RUN_STATUS_TONE } from "../lib/run-status";
import { Badge } from "../components/ui/Badge";
import { ParticipantAvatars } from "../components/runs/ParticipantAvatars";
import { RunProgressBar } from "../components/runs/RunProgressBar";
import { RunStatusControls } from "../components/runs/RunStatusControls";
import { ExecCaseRow } from "../components/runs/ExecCaseRow";
import { BugFromDraftModal } from "../components/bugs/BugFromDraftModal";

/**
 * DESIGN.md variant-c-bold "SCREEN 4: LIVE EXECUTION" — 이 프로젝트의 핵심 셀링포인트 화면.
 * useRunSocket이 소켓 룸 조인·재조인·캐시 패치를 전담하므로, 이 컴포넌트는 화면 조합에만 집중한다.
 */
export function RunExecutionPage() {
  const { runId = "" } = useParams<{ runId: string }>();
  const { current } = useCurrentOrg();
  const userId = useAuthStore((s) => s.user?.id);
  const { data: run, isLoading: runLoading } = useRun(runId);
  const { data: cases = [], isLoading: casesLoading } = useRunCases(runId);
  const { participants } = useRunSocket(runId);
  const [failCaseId, setFailCaseId] = useState<string | null>(null);

  if (runLoading || casesLoading || !run) {
    return <p className="text-[12.5px] text-ink/60">불러오는 중...</p>;
  }

  const isAssigned = run.assignees.some((a) => a.userId === userId);
  const canManage = roleAtLeast(current?.role, "QA_LEAD");
  // API.md 5장: QA_LEAD+는 배정 없이도 기록 가능, TESTER는 배정된 실행만(RUN_NOT_ASSIGNED 403 방지용 UI 게이팅).
  const canRecord =
    run.status === "IN_PROGRESS" &&
    (canManage || (roleAtLeast(current?.role, "TESTER") && isAssigned));

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-[20px] font-extrabold">{run.name}</h2>
          <Badge tone={RUN_STATUS_TONE[run.status]}>
            {RUN_STATUS_LABEL[run.status]}
          </Badge>
        </div>
        <div className="flex items-center gap-3">
          {run.status === "IN_PROGRESS" && (
            <span className="flex items-center gap-2 border-[1.5px] border-pass bg-pass-tint px-2.5 py-1.5 text-[11px] font-extrabold tracking-[0.04em] text-pass">
              <span className="animate-pulse-live h-2 w-2 rounded-full bg-pass" />
              LIVE · {participants.length} 참여 중
            </span>
          )}
          {canManage && <RunStatusControls runId={runId} status={run.status} />}
        </div>
      </div>

      <ParticipantAvatars participants={participants} />
      <RunProgressBar counters={run} />

      {!canRecord && run.status === "IN_PROGRESS" && (
        <p className="mb-4 border-[1.5px] border-blocked bg-blocked-tint px-3 py-2 text-[11px] font-bold text-blocked">
          이 실행에 배정되지 않아 결과를 기록할 수 없습니다. QA_LEAD에게 배정을
          요청하세요.
        </p>
      )}
      {run.status !== "IN_PROGRESS" && (
        <p className="mb-4 border-[1.5px] border-paper-line-strong bg-paper px-3 py-2 text-[11px] font-bold text-ink/60">
          실행이 진행 중이 아니라 결과를 기록할 수 없습니다(상태: {run.status}).
        </p>
      )}

      <div>
        {cases.map((caseItem) => (
          <ExecCaseRow
            key={caseItem.id}
            runId={runId}
            caseItem={caseItem}
            disabled={!canRecord}
            onFailRecorded={setFailCaseId}
          />
        ))}
      </div>

      {failCaseId && (
        <BugFromDraftModal
          runId={runId}
          runCaseId={failCaseId}
          onClose={() => setFailCaseId(null)}
        />
      )}
    </div>
  );
}
