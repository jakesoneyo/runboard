import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { useCurrentOrg } from "../features/orgs/hooks";
import { useRuns } from "../features/runs/hooks";
import { useSuiteTree } from "../features/suites/hooks";
import { roleAtLeast } from "../lib/roles";
import { RUN_STATUS_LABEL, RUN_STATUS_TONE } from "../lib/run-status";
import { PanelLabel } from "../components/ui/Panel";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { RunFormModal } from "../components/runs/RunFormModal";
import type { RunStatus } from "../types/api";

const STATUS_FILTERS: (RunStatus | "")[] = [
  "",
  "PLANNED",
  "IN_PROGRESS",
  "COMPLETED",
  "ABORTED",
];

/** API.md 5장 — 실행 목록. QA_LEAD+만 새 실행을 만들 수 있다(POST 권한과 동일 기준). */
export function RunsPage() {
  const { current } = useCurrentOrg();
  const { data: tree = [] } = useSuiteTree();
  const [status, setStatus] = useState<RunStatus | "">("");
  const [showCreate, setShowCreate] = useState(false);
  const canCreate = roleAtLeast(current?.role, "QA_LEAD");

  const { data, isLoading } = useRuns({
    status: status || undefined,
    take: 50,
  });

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <PanelLabel>EXECUTION RUNS</PanelLabel>
        {canCreate && (
          <Button variant="primary" onClick={() => setShowCreate(true)}>
            <Plus size={14} /> 새 실행
          </Button>
        )}
      </div>

      <div className="mb-4 flex gap-1.5">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s || "ALL"}
            type="button"
            onClick={() => setStatus(s)}
            className={`border-[1.5px] px-3 py-1.5 text-[11px] font-bold ${
              status === s
                ? "border-ink bg-ink text-white"
                : "border-paper-line-strong text-ink/60 hover:border-ink"
            }`}
          >
            {s || "전체"}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-[12.5px] text-ink/60">불러오는 중...</p>
      ) : data && data.items.length === 0 ? (
        <p className="border-[1.5px] border-ink bg-paper-raised p-6 text-[12.5px] text-ink/60">
          실행이 없습니다.
        </p>
      ) : (
        <div className="border-[1.5px] border-ink bg-paper-raised">
          {data?.items.map((run) => (
            <Link
              key={run.id}
              to={`/runs/${run.id}`}
              className="flex items-center gap-4 border-b border-paper-line px-5 py-4 last:border-b-0 hover:bg-paper"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-bold">{run.name}</div>
                <div className="text-[10.5px] text-ink/50">
                  {run.passedCount}/{run.totalCount} PASS ·{" "}
                  {Math.round(run.progress * 100)}% 진행
                </div>
              </div>
              <div className="flex flex-none -space-x-2">
                {run.assignees.slice(0, 4).map((a) => (
                  <span
                    key={a.userId}
                    title={a.name}
                    className="flex h-6 w-6 items-center justify-center border-2 border-paper-raised bg-ink text-[10px] font-extrabold text-white"
                  >
                    {a.name.slice(0, 2).toUpperCase()}
                  </span>
                ))}
              </div>
              <Badge tone={RUN_STATUS_TONE[run.status]} className="flex-none">
                {RUN_STATUS_LABEL[run.status]}
              </Badge>
            </Link>
          ))}
        </div>
      )}

      {showCreate && (
        <RunFormModal suiteTree={tree} onClose={() => setShowCreate(false)} />
      )}
    </div>
  );
}
