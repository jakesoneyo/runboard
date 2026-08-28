// 백엔드 backend/src/suites/dto/create-suite.schema.ts와 필드 형태만 동일하게 맞춘다.
import { z } from "zod";

export const suiteFormSchema = z.object({
  name: z.string().min(1, "스위트 이름을 입력해주세요.").max(200),
  description: z.string().max(2000).optional().or(z.literal("")),
  parentId: z.string().uuid().optional(),
});

export type SuiteFormInput = z.infer<typeof suiteFormSchema>;
