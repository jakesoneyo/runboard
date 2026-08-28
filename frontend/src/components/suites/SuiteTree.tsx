import { useState } from "react";
import { ChevronDown, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
import type { SuiteTreeNode } from "../../types/api";
import { useDeleteSuite } from "../../features/suites/hooks";
import { getErrorMessage } from "../../lib/errors";
import { useUiStore } from "../../stores/ui-store";

interface SuiteTreeProps {
  nodes: SuiteTreeNode[];
  selectedSuiteId: string | null;
  onSelect: (suiteId: string | null) => void;
  canEdit: boolean;
  onEdit: (suite: SuiteTreeNode) => void;
}

/** variant-c-bold .tree — 접기/펼치기 가능한 스위트 트리. QA_LEAD+만 수정/삭제 아이콘을 본다. */
export function SuiteTree({
  nodes,
  selectedSuiteId,
  onSelect,
  canEdit,
  onEdit,
}: SuiteTreeProps) {
  return (
    <div>
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={`mb-2 w-full px-1.5 py-2 text-left text-[12px] font-bold ${
          selectedSuiteId === null ? "text-accent-ink" : "text-ink/70"
        }`}
      >
        전체 케이스
      </button>
      {nodes.map((node) => (
        <SuiteNode
          key={node.id}
          node={node}
          depth={0}
          selectedSuiteId={selectedSuiteId}
          onSelect={onSelect}
          canEdit={canEdit}
          onEdit={onEdit}
        />
      ))}
    </div>
  );
}

function SuiteNode({
  node,
  depth,
  selectedSuiteId,
  onSelect,
  canEdit,
  onEdit,
}: {
  node: SuiteTreeNode;
  depth: number;
} & Pick<
  SuiteTreeProps,
  "selectedSuiteId" | "onSelect" | "canEdit" | "onEdit"
>) {
  const [expanded, setExpanded] = useState(true);
  const deleteSuite = useDeleteSuite();
  const showToast = useUiStore((s) => s.showToast);
  const hasChildren = node.children.length > 0;

  function handleDelete() {
    const confirmed = window.confirm(
      `"${node.name}" 스위트를 삭제할까요? 하위 스위트와 케이스가 모두 함께 삭제됩니다.`
    );
    if (!confirmed) return;
    deleteSuite.mutate(node.id, {
      onError: (error) => showToast(getErrorMessage(error)),
    });
  }

  return (
    <div className="mb-0.5">
      <div
        className="group flex items-center gap-1.5 py-1.5"
        style={{ paddingLeft: depth * 14 }}
      >
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-ink/40 disabled:opacity-0"
          disabled={!hasChildren}
          aria-label={expanded ? "접기" : "펼치기"}
        >
          {hasChildren ? (
            expanded ? (
              <ChevronDown size={14} />
            ) : (
              <ChevronRight size={14} />
            )
          ) : (
            <ChevronRight size={14} className="invisible" />
          )}
        </button>
        <button
          type="button"
          onClick={() => onSelect(node.id)}
          className={`flex-1 truncate text-left text-[12px] font-bold ${
            selectedSuiteId === node.id ? "text-accent-ink" : "text-ink"
          }`}
        >
          {node.name}
          <span className="ml-1.5 text-[10px] font-bold text-ink/40">
            {node.caseCount}
          </span>
        </button>
        {canEdit && (
          <div className="hidden gap-1 group-hover:flex">
            <button
              type="button"
              aria-label="스위트 수정"
              onClick={() => onEdit(node)}
              className="text-ink/40 hover:text-ink"
            >
              <Pencil size={13} />
            </button>
            <button
              type="button"
              aria-label="스위트 삭제"
              onClick={handleDelete}
              className="text-ink/40 hover:text-fail"
            >
              <Trash2 size={13} />
            </button>
          </div>
        )}
      </div>
      {hasChildren && expanded && (
        <div className="ml-[17px] border-l-[1.5px] border-dashed border-paper-line-strong pl-2">
          {node.children.map((child) => (
            <SuiteNode
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedSuiteId={selectedSuiteId}
              onSelect={onSelect}
              canEdit={canEdit}
              onEdit={onEdit}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function NewSuiteRootButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-2 flex w-full items-center gap-1.5 border-[1.5px] border-dashed border-paper-line-strong px-2 py-2 text-[11px] font-bold text-ink/60 hover:border-ink hover:text-ink"
    >
      <Plus size={13} /> 새 스위트
    </button>
  );
}
