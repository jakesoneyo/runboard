// API.md 5장 POST /orgs/:orgId/runs. 케이스는 suiteIds(그 스위트의 모든 케이스)와 caseIds(개별 지정)를
// 합집합으로 선택한다 — 실제로 0건이 되는지는 서비스 계층에서 DB 조회 후 재확인한다(존재하지 않는
// suiteId/caseId를 넣어도 여기 스키마만으로는 알 수 없기 때문).
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const createRunSchema = z
  .object({
    name: z.string().min(1, '실행 이름을 입력해주세요.').max(200),
    description: z.string().max(2000).optional(),
    suiteIds: z.array(z.string().uuid()).optional(),
    caseIds: z.array(z.string().uuid()).optional(),
    assigneeIds: z.array(z.string().uuid()).optional(),
  })
  .refine(
    (v) => (v.suiteIds?.length ?? 0) > 0 || (v.caseIds?.length ?? 0) > 0,
    {
      message: 'suiteIds 또는 caseIds 중 하나 이상을 지정해야 합니다.',
      path: ['caseIds'],
    },
  );

export class CreateRunDto extends createZodDto(createRunSchema) {}
