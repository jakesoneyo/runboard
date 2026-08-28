import { useState } from "react";
import { useCurrentOrg } from "../features/orgs/hooks";
import { useBug, useBugs, useUpdateBug } from "../features/bugs/hooks";
import { useMembers } from "../features/members/hooks";
import { roleAtLeast } from "../lib/roles";
import { getErrorMessage } from "../lib/errors";
import { useUiStore } from "../stores/ui-store";
import { BUG_SEVERITIES, BUG_STATUSES } from "../schemas/bug.schema";
import type { BugSeverity, BugStatus } from "../types/api";
import { PanelLabel } from "../components/ui/Panel";
import { Badge, type BadgeTone } from "../components/ui/Badge";
import { Select } from "../components/ui/Field";

const SEVERITY_TONE: Record<BugSeverity, BadgeTone> = {
  CRITICAL: "fail",
  MAJOR: "blocked",
  MINOR: "skip",
};

const STATUS_TONE: Record<BugStatus, BadgeTone> = {
  OPEN: "fail",
  IN_PROGRESS: "accent",
  RESOLVED: "pass",
  WONTFIX: "skip",
};

/**
 * API.md 6장 — 버그 목록. 생성은 실행 보드의 FAIL 흐름(BugFromDraftModal)으로만 이뤄지고,
 * 여기서는 조회 + 상태/심각도/담당자 변경(QA_LEAD+)만 다룬다(PLAN.md C7 범위).
 */
export function BugsPage() {
  const { current } = useCurrentOrg();
  const canManage = roleAtLeast(current?.role, "QA_LEAD");
  const [status, setStatus] = useState<BugStatus | "">("");
  const [severity, setSeverity] = useState<BugSeverity | "">("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading } = useBugs({
    status: status || undefined,
    severity: severity || undefined,
    take: 50,
  });

  return (
    <div>
      <PanelLabel>BUG REPORTS</PanelLabel>

      <div className="mb-4 flex flex-wrap gap-2">
        <Select
          value={status}
          onChange={(e) => setStatus(e.target.value as BugStatus | "")}
          className="max-w-[180px]"
        >
          <option value="">전체 상태</option>
          {BUG_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
        <Select
          value={severity}
          onChange={(e) => setSeverity(e.target.value as BugSeverity | "")}
          className="max-w-[180px]"
        >
          <option value="">전체 심각도</option>
          {BUG_SEVERITIES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
      </div>

      {isLoading ? (
        <p className="text-[12.5px] text-ink/60">불러오는 중...</p>
      ) : data && data.items.length === 0 ? (
        <p className="border-[1.5px] border-ink bg-paper-raised p-6 text-[12.5px] text-ink/60">
          버그가 없습니다.
        </p>
      ) : (
        <div className="border-[1.5px] border-ink bg-paper-raised">
          {data?.items.map((bug) => (
            <div
              key={bug.id}
              className="border-b border-paper-line last:border-b-0"
            >
              <button
                type="button"
                onClick={() =>
                  setExpandedId((prev) => (prev === bug.id ? null : bug.id))
                }
                className="flex w-full items-center gap-3.5 px-5 py-3.5 text-left hover:bg-paper"
              >
                <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">
                  {bug.title}
                </span>
                <Badge tone={SEVERITY_TONE[bug.severity]}>{bug.severity}</Badge>
                <Badge tone={STATUS_TONE[bug.status]}>{bug.status}</Badge>
              </button>
              {expandedId === bug.id && (
                <BugDetailPanel bugId={bug.id} canManage={canManage} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BugDetailPanel({
  bugId,
  canManage,
}: {
  bugId: string;
  canManage: boolean;
}) {
  const { data: bug, isLoading } = useBug(bugId);
  const { data: members = [] } = useMembers();
  const updateBug = useUpdateBug();
  const showToast = useUiStore((s) => s.showToast);

  if (isLoading || !bug) {
    return <p className="px-5 py-4 text-[12px] text-ink/60">불러오는 중...</p>;
  }

  return (
    <div className="border-t border-paper-line-strong bg-paper px-5 py-4">
      <p className="mb-3 text-[12.5px] whitespace-pre-wrap text-ink/80">
        {bug.description}
      </p>
      {bug.runCase && (
        <p className="mb-3 text-[11px] text-ink/50">
          연결된 실행 케이스: {bug.runCase.title} ({bug.runCase.result})
        </p>
      )}
      <ol className="mb-4 list-decimal space-y-1 pl-6 text-[12px]">
        {bug.stepsToReproduce.map((step) => (
          <li key={step.order}>
            {step.action}
            {step.expected && (
              <span className="text-ink/50"> → {step.expected}</span>
            )}
          </li>
        ))}
      </ol>

      {canManage ? (
        <div className="flex flex-wrap gap-2">
          <Select
            aria-label="상태"
            value={bug.status}
            onChange={(e) =>
              updateBug.mutate(
                { bugId, payload: { status: e.target.value as BugStatus } },
                { onError: (error) => showToast(getErrorMessage(error)) }
              )
            }
            className="!w-auto py-1.5"
          >
            {BUG_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
          <Select
            aria-label="심각도"
            value={bug.severity}
            onChange={(e) =>
              updateBug.mutate(
                {
                  bugId,
                  payload: { severity: e.target.value as BugSeverity },
                },
                { onError: (error) => showToast(getErrorMessage(error)) }
              )
            }
            className="!w-auto py-1.5"
          >
            {BUG_SEVERITIES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
          <Select
            aria-label="담당자"
            value={bug.assigneeId ?? ""}
            onChange={(e) =>
              updateBug.mutate(
                {
                  bugId,
                  payload: { assigneeId: e.target.value || null },
                },
                { onError: (error) => showToast(getErrorMessage(error)) }
              )
            }
            className="!w-auto py-1.5"
          >
            <option value="">담당자 없음</option>
            {members.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.name}
              </option>
            ))}
          </Select>
        </div>
      ) : (
        <p className="text-[11px] text-ink/50">
          상태·심각도·담당자 변경은 QA_LEAD 이상만 가능합니다.
        </p>
      )}
    </div>
  );
}
