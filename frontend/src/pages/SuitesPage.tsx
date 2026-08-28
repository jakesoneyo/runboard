import { useState } from "react";
import { useCurrentOrg } from "../features/orgs/hooks";
import { useSuiteTree } from "../features/suites/hooks";
import { useCase } from "../features/cases/hooks";
import { roleAtLeast } from "../lib/roles";
import { PanelLabel } from "../components/ui/Panel";
import { NewSuiteRootButton, SuiteTree } from "../components/suites/SuiteTree";
import { SuiteFormModal } from "../components/suites/SuiteFormModal";
import { CaseList } from "../components/cases/CaseList";
import { CaseFormModal } from "../components/cases/CaseFormModal";
import type { SuiteTreeNode } from "../types/api";

type SuiteModalState =
  { mode: "create" } | { mode: "edit"; suite: SuiteTreeNode } | null;
type CaseModalState =
  { mode: "create" } | { mode: "edit"; caseId: string } | null;

/** API.md 4장 스위트/케이스 화면 — 좌측 트리로 필터링, 우측 목록에서 CRUD. */
export function SuitesPage() {
  const { current } = useCurrentOrg();
  const { data: tree = [], isLoading } = useSuiteTree();
  const [selectedSuiteId, setSelectedSuiteId] = useState<string | null>(null);
  const [suiteModal, setSuiteModal] = useState<SuiteModalState>(null);
  const [caseModal, setCaseModal] = useState<CaseModalState>(null);

  // QA_LEAD 미만은 생성/수정/삭제 버튼 자체를 못 보게 한다 — 서버도 동일 기준(RolesGuard)으로
  // 403을 던지므로 숨김이 뚫려도(devtools로 강제 클릭 등) 결과는 항상 서버가 최종 결정한다.
  const canEdit = roleAtLeast(current?.role, "QA_LEAD");

  return (
    <div>
      <PanelLabel>TEST SUITES &amp; CASES</PanelLabel>
      <div className="grid grid-cols-1 border-[1.5px] border-ink md:grid-cols-[280px_1fr]">
        <div className="border-b-[1.5px] border-ink bg-paper-raised p-5 md:border-r-[1.5px] md:border-b-0">
          {isLoading ? (
            <p className="text-[12px] text-ink/60">불러오는 중...</p>
          ) : (
            <SuiteTree
              nodes={tree}
              selectedSuiteId={selectedSuiteId}
              onSelect={setSelectedSuiteId}
              canEdit={canEdit}
              onEdit={(suite) => setSuiteModal({ mode: "edit", suite })}
            />
          )}
          {canEdit && (
            <NewSuiteRootButton
              onClick={() => setSuiteModal({ mode: "create" })}
            />
          )}
        </div>

        <CaseList
          suiteId={selectedSuiteId}
          canEdit={canEdit}
          onCreate={() => setCaseModal({ mode: "create" })}
          onEdit={(caseId) => setCaseModal({ mode: "edit", caseId })}
        />
      </div>

      {suiteModal && (
        <SuiteFormModal
          tree={tree}
          editing={
            suiteModal.mode === "edit"
              ? {
                  id: suiteModal.suite.id,
                  name: suiteModal.suite.name,
                }
              : undefined
          }
          defaultParentId={selectedSuiteId ?? undefined}
          onClose={() => setSuiteModal(null)}
        />
      )}

      {caseModal?.mode === "create" && (
        <CaseFormModal
          suiteTree={tree}
          defaultSuiteId={selectedSuiteId}
          onClose={() => setCaseModal(null)}
        />
      )}
      {caseModal?.mode === "edit" && (
        <CaseEditModal
          caseId={caseModal.caseId}
          suiteTree={tree}
          onClose={() => setCaseModal(null)}
        />
      )}
    </div>
  );
}

/** 상세(steps 포함)는 목록에 없는 필드라 편집 모달을 열 때 별도로 GET한다. */
function CaseEditModal({
  caseId,
  suiteTree,
  onClose,
}: {
  caseId: string;
  suiteTree: SuiteTreeNode[];
  onClose: () => void;
}) {
  const { data, isLoading } = useCase(caseId);

  if (isLoading || !data) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40">
        <p className="border-2 border-ink bg-paper-raised px-6 py-4 text-[13px] font-bold">
          불러오는 중...
        </p>
      </div>
    );
  }

  return (
    <CaseFormModal suiteTree={suiteTree} editing={data} onClose={onClose} />
  );
}
