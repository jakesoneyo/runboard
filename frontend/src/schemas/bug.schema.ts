// 백엔드 backend/src/bugs/dto/create-bug.schema.ts·update-bug.schema.ts와 필드 형태를 맞춘다.
import { z } from "zod";
import { caseStepsSchema } from "./case.schema";

export const BUG_SEVERITIES = ["MINOR", "MAJOR", "CRITICAL"] as const;
export const BUG_STATUSES = [
  "OPEN",
  "IN_PROGRESS",
  "RESOLVED",
  "WONTFIX",
] as const;

export const bugFormSchema = z.object({
  title: z.string().min(1, "버그 제목을 입력해주세요.").max(200),
  description: z.string().min(1, "설명을 입력해주세요.").max(5000),
  stepsToReproduce: caseStepsSchema,
  severity: z.enum(BUG_SEVERITIES),
  testRunCaseId: z.string().uuid().optional(),
});

export type BugFormInput = z.infer<typeof bugFormSchema>;
