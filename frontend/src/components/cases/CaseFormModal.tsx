import { useState, type FormEvent } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { CASE_PRIORITIES, caseFormSchema } from "../../schemas/case.schema";
import { flattenSuiteTree } from "../../features/suites/api";
import { useCreateCase, useUpdateCase } from "../../features/cases/hooks";
import type { CaseDetail, CasePriority, SuiteTreeNode } from "../../types/api";
import { Modal } from "../ui/Modal";
import { Field, Select, TextArea, TextInput } from "../ui/Field";
import { Button } from "../ui/Button";
import { getErrorMessage } from "../../lib/errors";
import { fieldErrors } from "../../lib/zod-errors";

interface StepDraft {
  action: string;
  expected: string;
}

const EMPTY_STEP: StepDraft = { action: "", expected: "" };

/**
 * 케이스 생성/수정 공용 모달. steps는 UI에서 순서를 배열 인덱스로만 다루고(위/아래 버튼),
 * 제출 시점에 index+1을 order로 붙여 보낸다 — 사용자가 order 숫자를 직접 입력하게 하면
 * "3번과 5번만 있고 4번이 없다" 같은 무의미한 오류 상태가 쉽게 생기기 때문.
 */
export function CaseFormModal({
  suiteTree,
  editing,
  defaultSuiteId,
  onClose,
}: {
  suiteTree: SuiteTreeNode[];
  editing?: CaseDetail;
  defaultSuiteId?: string | null;
  onClose: () => void;
}) {
  const [suiteId, setSuiteId] = useState(
    editing?.suiteId ?? defaultSuiteId ?? ""
  );
  const [title, setTitle] = useState(editing?.title ?? "");
  const [preconditions, setPreconditions] = useState(
    editing?.preconditions ?? ""
  );
  const [expectedResult, setExpectedResult] = useState(
    editing?.expectedResult ?? ""
  );
  const [priority, setPriority] = useState<CasePriority>(
    editing?.priority ?? "MEDIUM"
  );
  const [steps, setSteps] = useState<StepDraft[]>(
    editing?.steps.map((s) => ({
      action: s.action,
      expected: s.expected ?? "",
    })) ?? [{ ...EMPTY_STEP }]
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  const createCase = useCreateCase();
  const updateCase = useUpdateCase();
  const isPending = createCase.isPending || updateCase.isPending;
  const mutationError = createCase.error ?? updateCase.error;
  const suiteOptions = flattenSuiteTree(suiteTree);

  function updateStep(index: number, patch: Partial<StepDraft>) {
    setSteps((prev) =>
      prev.map((s, i) => (i === index ? { ...s, ...patch } : s))
    );
  }

  function moveStep(index: number, direction: -1 | 1) {
    setSteps((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function removeStep(index: number) {
    setSteps((prev) =>
      prev.length > 1 ? prev.filter((_, i) => i !== index) : prev
    );
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const parsed = caseFormSchema.safeParse({
      suiteId,
      title,
      preconditions: preconditions || undefined,
      expectedResult,
      priority,
      steps: steps.map((s, i) => ({
        order: i + 1,
        action: s.action,
        expected: s.expected || undefined,
      })),
    });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    const payload = parsed.data;
    const onSuccess = () => onClose();
    if (editing) {
      updateCase.mutate({ caseId: editing.id, payload }, { onSuccess });
    } else {
      createCase.mutate(payload, { onSuccess });
    }
  }

  return (
    <Modal title={editing ? "케이스 수정" : "새 케이스"} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <Field label="스위트" htmlFor="case-suite" error={errors.suiteId}>
          <Select
            id="case-suite"
            value={suiteId}
            onChange={(e) => setSuiteId(e.target.value)}
          >
            <option value="" disabled>
              스위트를 선택하세요
            </option>
            {suiteOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {"— ".repeat(opt.depth)}
                {opt.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="제목" htmlFor="case-title" error={errors.title}>
          <TextInput
            id="case-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </Field>

        <Field label="우선순위" htmlFor="case-priority">
          <Select
            id="case-priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value as CasePriority)}
          >
            {CASE_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="사전조건(선택)" htmlFor="case-preconditions">
          <TextArea
            id="case-preconditions"
            rows={2}
            value={preconditions}
            onChange={(e) => setPreconditions(e.target.value)}
          />
        </Field>

        <div className="mb-1.5 flex items-center justify-between">
          <span className="block text-[11px] font-bold tracking-[0.04em]">
            스텝
          </span>
          <button
            type="button"
            onClick={() => setSteps((prev) => [...prev, { ...EMPTY_STEP }])}
            className="flex items-center gap-1 text-[11px] font-bold text-accent-ink"
          >
            <Plus size={13} /> 스텝 추가
          </button>
        </div>
        {errors.steps && (
          <p className="mb-2 text-[10.5px] font-bold text-fail">
            {errors.steps}
          </p>
        )}
        <div className="mb-4 flex flex-col gap-2">
          {steps.map((step, index) => (
            <div
              key={index}
              className="flex gap-2 border-[1.5px] border-paper-line-strong p-2.5"
            >
              <span className="pt-2.5 text-[11px] font-bold text-ink/40">
                {index + 1}
              </span>
              <div className="flex-1 space-y-2">
                <TextInput
                  placeholder="액션(예: 게스트 결제 페이지로 이동)"
                  value={step.action}
                  onChange={(e) =>
                    updateStep(index, { action: e.target.value })
                  }
                />
                <TextInput
                  placeholder="예상 결과(선택)"
                  value={step.expected}
                  onChange={(e) =>
                    updateStep(index, { expected: e.target.value })
                  }
                />
              </div>
              <div className="flex flex-col gap-1">
                <button
                  type="button"
                  aria-label="위로 이동"
                  onClick={() => moveStep(index, -1)}
                  className="text-ink/40 hover:text-ink disabled:opacity-20"
                  disabled={index === 0}
                >
                  <ArrowUp size={13} />
                </button>
                <button
                  type="button"
                  aria-label="아래로 이동"
                  onClick={() => moveStep(index, 1)}
                  className="text-ink/40 hover:text-ink disabled:opacity-20"
                  disabled={index === steps.length - 1}
                >
                  <ArrowDown size={13} />
                </button>
                <button
                  type="button"
                  aria-label="스텝 삭제"
                  onClick={() => removeStep(index)}
                  className="text-ink/40 hover:text-fail disabled:opacity-20"
                  disabled={steps.length === 1}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>

        <Field
          label="예상결과"
          htmlFor="case-expected-result"
          error={errors.expectedResult}
        >
          <TextArea
            id="case-expected-result"
            rows={2}
            value={expectedResult}
            onChange={(e) => setExpectedResult(e.target.value)}
          />
        </Field>

        {mutationError && (
          <p className="mb-3 text-[11px] font-bold text-fail">
            {getErrorMessage(mutationError)}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            취소
          </Button>
          <Button type="submit" variant="primary" disabled={isPending}>
            {isPending ? "저장 중..." : "저장"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
