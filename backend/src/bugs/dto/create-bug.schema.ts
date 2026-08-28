// API.md 6장 POST /orgs/:orgId/bugs. stepsToReproduce는 케이스 steps와 같은 모양이라
// cases/case.schema.ts의 스키마를 그대로 재사용한다(ponytail — 같은 규칙을 두 곳에 베끼지 않는다).
import { BugSeverity } from '@prisma/client';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { caseStepsSchema } from '../../cases/case.schema';

export const createBugSchema = z.object({
  title: z.string().min(1, '버그 제목을 입력해주세요.').max(200),
  description: z.string().min(1).max(5000),
  stepsToReproduce: caseStepsSchema,
  severity: z.nativeEnum(BugSeverity).default(BugSeverity.MAJOR),
  // 지정 시 서비스 계층에서 tenant-scoped 조회로 존재 검증(다른 조직 소속이면 404).
  testRunCaseId: z.string().uuid().optional(),
});

export class CreateBugDto extends createZodDto(createBugSchema) {}
