// API.md 4장 — 테스트케이스 Zod 스키마. 서비스 로직(cases.service.ts)과 분리해 두는 이유:
// steps 스키마는 실행 화면(C6/C7 프론트)에서도 그대로 재사용할 값 형태라, 백엔드 전용 로직과
// 섞이지 않는 이 파일만 복사/공유해도 프론트가 같은 검증 규칙을 쓸 수 있게 하기 위함이다.
import { CasePriority } from '@prisma/client';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/** DATA-MODEL.md 3장: steps는 Json이지만 항상 이 모양을 지킨다. */
export const caseStepSchema = z.object({
  order: z.number().int().min(1),
  action: z.string().min(1).max(500),
  expected: z.string().max(500).optional(),
});

/** API.md 4장: 1~50개. */
export const caseStepsSchema = z.array(caseStepSchema).min(1).max(50);

export const createCaseSchema = z.object({
  suiteId: z.string().uuid(),
  title: z.string().min(1, '케이스 제목을 입력해주세요.').max(200),
  preconditions: z.string().max(2000).optional(),
  steps: caseStepsSchema,
  expectedResult: z.string().min(1).max(2000),
  priority: z.nativeEnum(CasePriority).default(CasePriority.MEDIUM),
});

export class CreateCaseDto extends createZodDto(createCaseSchema) {}

/** 부분 수정. suiteId를 보내면 다른 스위트로 이동한다. */
export const updateCaseSchema = z.object({
  suiteId: z.string().uuid().optional(),
  title: z.string().min(1).max(200).optional(),
  preconditions: z.string().max(2000).nullable().optional(),
  steps: caseStepsSchema.optional(),
  expectedResult: z.string().min(1).max(2000).optional(),
  priority: z.nativeEnum(CasePriority).optional(),
});

export class UpdateCaseDto extends createZodDto(updateCaseSchema) {}

export const listCasesQuerySchema = z.object({
  suiteId: z.string().uuid().optional(),
  priority: z.nativeEnum(CasePriority).optional(),
  q: z.string().min(1).max(200).optional(),
  cursor: z.string().uuid().optional(),
  take: z.coerce.number().int().min(1).max(100).default(20),
});

export class ListCasesQueryDto extends createZodDto(listCasesQuerySchema) {}
