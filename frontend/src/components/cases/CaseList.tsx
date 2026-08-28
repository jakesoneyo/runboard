import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useCases, useDeleteCase } from "../../features/cases/hooks";
import { CASE_PRIORITIES } from "../../schemas/case.schema";
import { PRIORITY_TONE } from "../../lib/priority";
import { getErrorMessage } from "../../lib/errors";
import { useUiStore } from "../../stores/ui-store";
import type { CasePriority } from "../../types/api";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Select, TextInput } from "../ui/Field";

export function CaseList({
  suiteId,
  canEdit,
  onEdit,
  onCreate,
}: {
  suiteId: string | null;
  canEdit: boolean;
  onEdit: (caseId: string) => void;
  onCreate: () => void;
}) {
  const [q, setQ] = useState("");
  const [priority, setPriority] = useState<CasePriority | "">("");
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const deleteCase = useDeleteCase();
  const showToast = useUiStore((s) => s.showToast);

  const { data, isLoading, isFetching } = useCases({
    suiteId: suiteId ?? undefined,
    q: q || undefined,
    priority: priority || undefined,
    cursor,
  });

  function handleDelete(caseId: string, title: string) {
    const confirmed = window.confirm(`"${title}" 케이스를 삭제할까요?`);
    if (!confirmed) return;
    deleteCase.mutate(caseId, {
      onError: (error) => showToast(getErrorMessage(error)),
    });
  }

  return (
    <div className="bg-paper-raised">
      <div className="flex flex-wrap items-center gap-2 border-b-[1.5px] border-paper-line-strong p-4">
        <TextInput
          placeholder="제목 검색"
          value={q}
          onChange={(e) => {
            setCursor(undefined);
            setQ(e.target.value);
          }}
          className="max-w-[220px]"
        />
        <Select
          value={priority}
          onChange={(e) => {
            setCursor(undefined);
            setPriority(e.target.value as CasePriority | "");
          }}
          className="max-w-[160px]"
        >
          <option value="">전체 우선순위</option>
          {CASE_PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </Select>
        {canEdit && (
          <Button variant="primary" className="ml-auto" onClick={onCreate}>
            <Plus size={14} /> 새 케이스
          </Button>
        )}
      </div>

      {isLoading ? (
        <p className="p-6 text-[12.5px] text-ink/60">불러오는 중...</p>
      ) : data && data.items.length === 0 ? (
        <p className="p-6 text-[12.5px] text-ink/60">케이스가 없습니다.</p>
      ) : (
        data?.items.map((item) => (
          <div
            key={item.id}
            className="group flex items-center gap-3.5 border-b border-paper-line px-6 py-3.5 last:border-b-0 hover:bg-paper"
          >
            <span className="w-14 flex-none text-[10.5px] text-ink/40">
              {item.id.slice(0, 6)}
            </span>
            <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">
              {item.title}
            </span>
            <Badge tone={PRIORITY_TONE[item.priority]}>{item.priority}</Badge>
            {canEdit && (
              <div className="flex flex-none gap-2 opacity-0 group-hover:opacity-100">
                <button
                  type="button"
                  aria-label="케이스 수정"
                  onClick={() => onEdit(item.id)}
                  className="text-ink/40 hover:text-ink"
                >
                  <Pencil size={14} />
                </button>
                <button
                  type="button"
                  aria-label="케이스 삭제"
                  onClick={() => handleDelete(item.id, item.title)}
                  className="text-ink/40 hover:text-fail"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            )}
          </div>
        ))
      )}

      {data?.nextCursor && (
        <div className="border-t-[1.5px] border-paper-line-strong p-3 text-center">
          <Button
            variant="ghost"
            disabled={isFetching}
            onClick={() => setCursor(data.nextCursor ?? undefined)}
          >
            더 보기
          </Button>
        </div>
      )}
    </div>
  );
}
