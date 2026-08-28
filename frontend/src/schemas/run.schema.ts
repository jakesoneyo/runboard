// 백엔드 backend/src/runs/dto/create-run.schema.ts와 필드 형태를 맞춘 프론트 전용 스키마.
import { z } from "zod";

export const runFormSchema = z
  .object({
    name: z.string().min(1, "실행 이름을 입력해주세요.").max(200),
    description: z.string().max(2000).optional().or(z.literal("")),
    suiteIds: z.array(z.string().uuid()).optional(),
    caseIds: z.array(z.string().uuid()).optional(),
    assigneeIds: z.array(z.string().uuid()).optional(),
  })
  .refine(
    (v) => (v.suiteIds?.length ?? 0) > 0 || (v.caseIds?.length ?? 0) > 0,
    {
      message: "스위트 또는 케이스를 하나 이상 선택해주세요.",
      path: ["caseIds"],
    }
  );

export type RunFormInput = z.infer<typeof runFormSchema>;
