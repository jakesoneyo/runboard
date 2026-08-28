import { useState, type FormEvent } from "react";
import { useBugDraft } from "../../features/runs/hooks";
import { useCreateBug } from "../../features/bugs/hooks";
import { BUG_SEVERITIES, bugFormSchema } from "../../schemas/bug.schema";
import type { BugDraft, BugSeverity } from "../../types/api";
import { Modal } from "../ui/Modal";
import { Field, Select, TextArea, TextInput } from "../ui/Field";
import { Button } from "../ui/Button";
import { getErrorMessage } from "../../lib/errors";
import { fieldErrors } from "../../lib/zod-errors";

/**
 * FAIL 기록 직후 뜨는 버그 생성 모달. GET .../bug-draft(API.md 5장)로 받은 제목/설명/재현 스텝을
 * 그대로 프리필하고, 사용자는 심각도만 고르고 필요하면 문구를 다듬어 제출한다 — 실패를 기록하고
 * 다시 버그를 처음부터 타이핑하는 이중 작업을 없앤다.
 */
export function BugFromDraftModal({
  runId,
  runCaseId,
  onClose,
}: {
  runId: string;
  runCaseId: string;
  onClose: () => void;
}) {
  const { data: draft, isLoading } = useBugDraft(runId, runCaseId);

  return (
    <Modal title="버그 리포트 작성" onClose={onClose}>
      {isLoading || !draft ? (
        <p className="text-[12.5px] text-ink/60">초안 불러오는 중...</p>
      ) : (
        <BugDraftForm draft={draft} runCaseId={runCaseId} onClose={onClose} />
      )}
    </Modal>
  );
}

/**
 * draft가 이미 로드된 뒤에만 마운트되므로 useState 초기값으로 바로 프리필한다 —
 * "데이터가 늦게 도착하면 effect로 다시 채운다" 패턴 대신 렌더 시점에 값을 확정한다.
 */
function BugDraftForm({
  draft,
  runCaseId,
  onClose,
}: {
  draft: BugDraft;
  runCaseId: string;
  onClose: () => void;
}) {
  const createBug = useCreateBug();
  const [title, setTitle] = useState(draft.title);
  const [description, setDescription] = useState(draft.description);
  const [severity, setSeverity] = useState<BugSeverity>("MAJOR");
  const [errors, setErrors] = useState<Record<string, string>>({});

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const parsed = bugFormSchema.safeParse({
      title,
      description,
      severity,
      stepsToReproduce: draft.stepsToReproduce,
      testRunCaseId: runCaseId,
    });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    createBug.mutate(parsed.data, { onSuccess: () => onClose() });
  }

  return (
    <form onSubmit={handleSubmit}>
      <Field label="제목" htmlFor="bug-title" error={errors.title}>
        <TextInput
          id="bug-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </Field>
      <Field label="심각도" htmlFor="bug-severity">
        <Select
          id="bug-severity"
          value={severity}
          onChange={(e) => setSeverity(e.target.value as BugSeverity)}
        >
          {BUG_SEVERITIES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="설명" htmlFor="bug-description" error={errors.description}>
        <TextArea
          id="bug-description"
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </Field>

      <div className="mb-4">
        <span className="mb-1.5 block text-[11px] font-bold tracking-[0.04em]">
          재현 스텝(실행 케이스 스냅샷 기반)
        </span>
        <ol className="list-decimal space-y-1 border-[1.5px] border-paper-line-strong p-3 pl-7 text-[12px]">
          {draft.stepsToReproduce.map((step) => (
            <li key={step.order}>
              {step.action}
              {step.expected && (
                <span className="text-ink/50"> → {step.expected}</span>
              )}
            </li>
          ))}
        </ol>
      </div>

      {createBug.isError && (
        <p className="mb-3 text-[11px] font-bold text-fail">
          {getErrorMessage(createBug.error)}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onClose}>
          건너뛰기
        </Button>
        <Button type="submit" variant="primary" disabled={createBug.isPending}>
          {createBug.isPending ? "저장 중..." : "버그 등록"}
        </Button>
      </div>
    </form>
  );
}
