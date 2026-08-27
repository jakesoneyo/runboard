// ARCHITECTURE.md 3장 "계층 2 — Prisma Client Extension(사고 방지)"의 실제 구현.
// 서비스 코드가 organizationId 필터를 손으로 쓰지 않아도, 여기서 모든 쿼리에 자동으로 주입/검증한다.
import { DomainException } from '../common/errors/domain-exception';
import { getRequestContext } from '../common/context/request-context';
import type { PrismaService } from './prisma.service';

/**
 * 조직 스코프가 자동 주입돼야 하는 모델 화이트리스트.
 * 제외 모델과 그 이유:
 * - User, RefreshToken: 전역 아이덴티티(조직에 속하지 않는다, DATA-MODEL.md 1장).
 * - Organization: 테넌트 앵커 그 자체 — organizationId 컬럼이 없다(자기 자신이 id).
 * - AuditLog: organizationId가 nullable이라 이 확장의 "항상 채운다" 규칙과 맞지 않는다.
 *   조직 스코프 이벤트/전역 이벤트 구분은 AuditService.record()/recordGlobal()이 직접 책임진다.
 */
export const TENANT_MODELS = new Set([
  'Membership',
  'Invitation',
  'TestSuite',
  'TestCase',
  'TestRun',
  'TestRunCase',
  'TestRunAssignee',
  'BugReport',
]);

/** 컨텍스트 없이 테넌트 모델을 조회하려 한 경우 — API.md의 TENANT_CONTEXT_MISSING(500, 버그 신호). */
export class MissingTenantContextError extends DomainException {
  constructor(model: string, operation: string) {
    super(
      500,
      'TENANT_CONTEXT_MISSING',
      `조직 컨텍스트 없이 테넌트 모델(${model}.${operation})을 조회했습니다.`,
    );
  }
}

type OperationArgs = Record<string, unknown>;

/**
 * 실제 organizationId 주입 로직. Prisma 4.5+의 "extended where unique input"(unique 셀렉터에
 * 임의 스칼라 필터를 더 얹는 것)이 findUnique/update/delete에도 허용되기 때문에, 모든 읽기·수정·삭제
 * 연산에 대해 단순히 where.organizationId를 덮어써도 된다 — 다른 조직 id로 조회하면 "없음"과
 * 동일하게 취급된다(존재 은닉 정책과도 일치).
 */
function applyTenantScope(
  operation: string,
  args: OperationArgs,
  organizationId: string,
): OperationArgs {
  switch (operation) {
    case 'create':
      // 호출자가 body 등으로 다른 organizationId를 끼워 넣어도(T-4) 마지막에 컨텍스트 값으로 덮어써 무시한다.
      return {
        ...args,
        data: { ...(args.data as OperationArgs), organizationId },
      };
    case 'createMany': {
      const data = args.data;
      const rows = Array.isArray(data) ? data : [data];
      return {
        ...args,
        data: rows.map((row) => ({
          ...(row as OperationArgs),
          organizationId,
        })),
      };
    }
    case 'upsert':
      return {
        ...args,
        where: { ...(args.where as OperationArgs), organizationId },
        create: { ...(args.create as OperationArgs), organizationId },
      };
    default:
      // findUnique/findUniqueOrThrow/findFirst/findFirstOrThrow/findMany/count/aggregate/groupBy
      // /update/updateMany/delete/deleteMany 전부 where 필터 하나로 처리된다.
      return {
        ...args,
        where: { ...(args.where ?? {}), organizationId },
      };
  }
}

/**
 * PrismaService(원본 클라이언트)에 적용해 조직 스코프가 자동 주입되는 확장 클라이언트를 만든다.
 * 시드/인증 모듈처럼 조직 컨텍스트가 없는 정당한 경로는 이 확장을 타지 않는 원본 PrismaService를
 * 그대로 쓴다(설계상 "$system" 역할 — PrismaModule 참고).
 */
export function createTenantScopedClient(prisma: PrismaService) {
  return prisma.$extends({
    name: 'tenant-scope',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!model || !TENANT_MODELS.has(model)) {
            return query(args);
          }
          const ctx = getRequestContext();
          if (!ctx?.organizationId) {
            throw new MissingTenantContextError(model, operation);
          }
          return query(applyTenantScope(operation, args, ctx.organizationId));
        },
      },
    },
  });
}
