// 백엔드 backend/src/cases/case.schema.ts와 필드 형태(steps 등)를 동일하게 맞춘 프론트 전용 스키마.
// 모노레포가 아니므로 backend/src를 import하지 않는다 — 백엔드 스키마가 바뀌면 이 파일도 함께 갱신한다.
import { z } from "zod";

export const CASE_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

/** DATA-MODEL.md 3장: steps는 Json이지만 항상 이 모양을 지킨다(1~50개). */
export const caseStepSchema = z.object({
  order: z.number().int().min(1),
  action: z.string().min(1, "액션을 입력해주세요.").max(500),
  expected: z.string().max(500).optional(),
});

export const caseStepsSchema = z.array(caseStepSchema).min(1).max(50);

export const caseFormSchema = z.object({
  suiteId: z.string().uuid("스위트를 선택해주세요."),
  title: z.string().min(1, "케이스 제목을 입력해주세요.").max(200),
  preconditions: z.string().max(2000).optional().or(z.literal("")),
  steps: caseStepsSchema,
  expectedResult: z.string().min(1, "예상결과를 입력해주세요.").max(2000),
  priority: z.enum(CASE_PRIORITIES),
});

export type CaseFormInput = z.infer<typeof caseFormSchema>;
