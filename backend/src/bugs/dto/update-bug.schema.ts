// API.md 6장 PATCH /orgs/:orgId/bugs/:bugId — 부분 수정. QA_LEAD+ 전용(컨트롤러에서 강제).
import { BugSeverity, BugStatus } from '@prisma/client';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { caseStepsSchema } from '../../cases/case.schema';

export const updateBugSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().min(1).max(5000).optional(),
  stepsToReproduce: caseStepsSchema.optional(),
  severity: z.nativeEnum(BugSeverity).optional(),
  status: z.nativeEnum(BugStatus).optional(),
  // null이면 담당자 해제. BugReport.assigneeId는 FK가 없는 단순 참조값이라(DATA-MODEL.md 3장)
  // 존재 검증은 하지 않는다 — TestRunAssignee.userId와 달리 조직 소속 강제 대상이 아니다.
  assigneeId: z.string().uuid().nullable().optional(),
});

export class UpdateBugDto extends createZodDto(updateBugSchema) {}
