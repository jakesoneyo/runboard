import { useState, type FormEvent } from "react";
import { suiteFormSchema } from "../../schemas/suite.schema";
import { flattenSuiteTree } from "../../features/suites/api";
import { useCreateSuite, useUpdateSuite } from "../../features/suites/hooks";
import type { SuiteTreeNode } from "../../types/api";
import { Modal } from "../ui/Modal";
import { Field, Select, TextArea, TextInput } from "../ui/Field";
import { Button } from "../ui/Button";
import { getErrorMessage } from "../../lib/errors";
import { fieldErrors } from "../../lib/zod-errors";

interface EditableSuite {
  id: string;
  name: string;
  description?: string;
  parentId?: string;
}

/**
 * 스위트 생성/수정 공용 모달 — parentId 셀렉트로 트리 어디에든 붙일 수 있다(깊이·순환은 서버가 최종 검증).
 * 주의: GET /orgs/:orgId/suites 트리 응답(API.md 4장)은 parentId·description을 내려주지 않아
 * 수정 모달을 열어도 이 두 필드는 빈 값으로 시작한다. 빈 채로 저장하면 그냥 "값을 안 보냄"이라
 * 서버가 기존 값을 덮어쓰지 않는다(cases/suites 서비스의 `dto.field ?? undefined` 패턴) —
 * 즉 실수로 지워지는 일은 없지만, 현재 설명/상위를 화면에 보여줄 수는 없다(백엔드에 단건 조회 API 없음).
 */
export function SuiteFormModal({
  tree,
  editing,
  defaultParentId,
  onClose,
}: {
  tree: SuiteTreeNode[];
  editing?: EditableSuite;
  defaultParentId?: string;
  onClose: () => void;
}) {
  const [name, setName] = useState(editing?.name ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [parentId, setParentId] = useState(
    editing?.parentId ?? defaultParentId ?? ""
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const createSuite = useCreateSuite();
  const updateSuite = useUpdateSuite();

  // 자기 자신을 자신의 상위로 지정하는 것만 프론트에서 미리 막는다(나머지 트리 규칙은 서버 400).
  const options = flattenSuiteTree(tree).filter((n) => n.id !== editing?.id);
  const isPending = createSuite.isPending || updateSuite.isPending;
  const mutationError = createSuite.error ?? updateSuite.error;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const parsed = suiteFormSchema.safeParse({
      name,
      description: description || undefined,
      parentId: parentId || undefined,
    });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    const payload = parsed.data;
    const onSuccess = () => onClose();
    if (editing) {
      updateSuite.mutate({ suiteId: editing.id, payload }, { onSuccess });
    } else {
      createSuite.mutate(payload, { onSuccess });
    }
  }

  return (
    <Modal title={editing ? "스위트 수정" : "새 스위트"} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <Field label="이름" htmlFor="suite-name" error={errors.name}>
          <TextInput
            id="suite-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field label="설명(선택)" htmlFor="suite-description">
          <TextArea
            id="suite-description"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
        <Field label="상위 스위트(선택)" htmlFor="suite-parent">
          <Select
            id="suite-parent"
            value={parentId}
            onChange={(e) => setParentId(e.target.value)}
          >
            <option value="">최상위</option>
            {options.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {"— ".repeat(opt.depth)}
                {opt.name}
              </option>
            ))}
          </Select>
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
