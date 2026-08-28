import { useState, type FormEvent } from "react";
import { runFormSchema } from "../../schemas/run.schema";
import { flattenSuiteTree } from "../../features/suites/api";
import { useCreateRun } from "../../features/runs/hooks";
import { useMembers } from "../../features/members/hooks";
import type { SuiteTreeNode } from "../../types/api";
import { Modal } from "../ui/Modal";
import { Field, TextArea, TextInput } from "../ui/Field";
import { Button } from "../ui/Button";
import { getErrorMessage } from "../../lib/errors";
import { fieldErrors } from "../../lib/zod-errors";

/**
 * 실행 생성 모달 — 케이스 단위 선택은 스코프 밖(ponytail): 스위트 전체 선택(하위 모든 케이스)만
 * 지원해도 "실행 대상 고르기"라는 요구는 충분히 채워진다. 서버는 suiteIds/caseIds 합집합을
 * 받으므로 세밀한 케이스 선택 UI는 필요해지면 나중에 얹을 수 있다.
 */
export function RunFormModal({
  suiteTree,
  onClose,
}: {
  suiteTree: SuiteTreeNode[];
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [suiteIds, setSuiteIds] = useState<Set<string>>(new Set());
  const [assigneeIds, setAssigneeIds] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});

  const suiteOptions = flattenSuiteTree(suiteTree);
  const { data: members = [] } = useMembers();
  const createRun = useCreateRun();

  function toggle(
    set: Set<string>,
    id: string,
    setter: (s: Set<string>) => void
  ) {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setter(next);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const parsed = runFormSchema.safeParse({
      name,
      description: description || undefined,
      suiteIds: [...suiteIds],
      assigneeIds: [...assigneeIds],
    });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    createRun.mutate(parsed.data, { onSuccess: () => onClose() });
  }

  return (
    <Modal title="새 실행" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <Field label="실행 이름" htmlFor="run-name" error={errors.name}>
          <TextInput
            id="run-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예: 결제 회귀 #483"
          />
        </Field>

        <Field label="설명(선택)" htmlFor="run-description">
          <TextArea
            id="run-description"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>

        <div className="mb-4">
          <span className="mb-1.5 block text-[11px] font-bold tracking-[0.04em]">
            대상 스위트(하위 케이스 전체 포함)
          </span>
          {errors.caseIds && (
            <p className="mb-1.5 text-[10.5px] font-bold text-fail">
              {errors.caseIds}
            </p>
          )}
          <div className="max-h-40 overflow-y-auto border-[1.5px] border-ink p-2.5">
            {suiteOptions.map((opt) => (
              <label
                key={opt.id}
                className="flex items-center gap-2 py-1 text-[12px] font-semibold"
                style={{ paddingLeft: opt.depth * 14 }}
              >
                <input
                  type="checkbox"
                  checked={suiteIds.has(opt.id)}
                  onChange={() => toggle(suiteIds, opt.id, setSuiteIds)}
                />
                {opt.name}
              </label>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <span className="mb-1.5 block text-[11px] font-bold tracking-[0.04em]">
            배정자(선택)
          </span>
          <div className="max-h-32 overflow-y-auto border-[1.5px] border-ink p-2.5">
            {members.map((member) => (
              <label
                key={member.userId}
                className="flex items-center gap-2 py-1 text-[12px] font-semibold"
              >
                <input
                  type="checkbox"
                  checked={assigneeIds.has(member.userId)}
                  onChange={() =>
                    toggle(assigneeIds, member.userId, setAssigneeIds)
                  }
                />
                {member.name}{" "}
                <span className="text-ink/40">({member.role})</span>
              </label>
            ))}
          </div>
        </div>

        {createRun.isError && (
          <p className="mb-3 text-[11px] font-bold text-fail">
            {getErrorMessage(createRun.error)}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            취소
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={createRun.isPending}
          >
            {createRun.isPending ? "생성 중..." : "실행 생성"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
