// PLAN.md 그룹 1 — tenant.extension.ts(Prisma Client Extension) 자체를 HTTP 계층을 거치지 않고
// 직접 검증한다. C3~C5에서 아직 컨트롤러가 없는 TestSuite/TestCase 같은 모델도 DB 테이블은 이미
// 존재하므로(C1에서 전체 스키마 적용) 격리 메커니즘 자체는 지금 증명할 수 있다.
import { Role } from '@prisma/client';
import { runWithRequestContext } from '../src/common/context/request-context';
import {
  TENANT_PRISMA,
  type TenantPrismaClient,
} from '../src/prisma/tenant-transaction.service';
import {
  bootstrapTestApp,
  teardownTestApp,
  type TestApp,
} from './support/test-app';

describe('tenant.extension.ts (e2e, 컨트롤러 우회 직접 검증)', () => {
  jest.setTimeout(120_000);

  let ctx: TestApp;
  let tenantPrisma: TenantPrismaClient;
  let orgA: { id: string };
  let orgB: { id: string };
  let userId: string;

  beforeAll(async () => {
    ctx = await bootstrapTestApp();
    tenantPrisma = ctx.moduleRef.get(TENANT_PRISMA);

    orgA = await ctx.prisma.organization.create({
      data: { name: 'Ext Org A', slug: `ext-org-a-${Date.now()}` },
    });
    orgB = await ctx.prisma.organization.create({
      data: { name: 'Ext Org B', slug: `ext-org-b-${Date.now()}` },
    });
    const user = await ctx.prisma.user.create({
      data: {
        email: `ext-user-${Date.now()}@example.com`,
        passwordHash: 'irrelevant',
        name: '확장 테스트용',
      },
    });
    userId = user.id;
  });

  afterAll(() => teardownTestApp(ctx));

  it('T-6: ALS 컨텍스트 없이 테넌트 모델을 조회하면 TENANT_CONTEXT_MISSING', async () => {
    await expect(tenantPrisma.membership.findMany()).rejects.toMatchObject({
      code: 'TENANT_CONTEXT_MISSING',
    });
  });

  it('T-4: create 시 body에 다른 organizationId를 넣어도 컨텍스트 값으로 덮어써 저장한다', async () => {
    // 주의: Prisma의 create()는 지연 실행되는 thenable이라, run() 콜백 "안에서" await해야만
    // ALS 컨텍스트가 실제 쿼리 디스패치 시점까지 살아있다(밖에서 await하면 컨텍스트가 이미 빠져나간 뒤다).
    const created = await runWithRequestContext(
      { organizationId: orgA.id, role: Role.ADMIN },
      async () =>
        tenantPrisma.membership.create({
          data: {
            userId,
            role: Role.ADMIN,
            organizationId: orgB.id, // 스푸핑 시도
          },
        }),
    );
    expect(created.organizationId).toBe(orgA.id);
    expect(created.organizationId).not.toBe(orgB.id);
  });

  it('T-3(확장 레벨): findMany는 다른 조직 레코드를 절대 포함하지 않는다', async () => {
    // orgB 소속 멤버십을 원본(비확장) 클라이언트로 하나 더 심어둔다(격리 대상이 실제로 존재해야 의미가 있다).
    const otherUser = await ctx.prisma.user.create({
      data: {
        email: `ext-other-${Date.now()}@example.com`,
        passwordHash: 'irrelevant',
        name: '다른 조직 사용자',
      },
    });
    await ctx.prisma.membership.create({
      data: {
        organizationId: orgB.id,
        userId: otherUser.id,
        role: Role.VIEWER,
      },
    });

    const results = await runWithRequestContext(
      { organizationId: orgA.id, role: Role.ADMIN },
      async () => tenantPrisma.membership.findMany(),
    );
    expect(results.every((m) => m.organizationId === orgA.id)).toBe(true);
    expect(results.some((m) => m.userId === otherUser.id)).toBe(false);
  });

  it('T-4/조회: 다른 조직 id로 findUnique를 시도해도 조용히 null(존재 은닉)', async () => {
    const orgBRow = await ctx.prisma.membership.findFirst({
      where: { organizationId: orgB.id },
    });
    expect(orgBRow).not.toBeNull();

    const found = await runWithRequestContext(
      { organizationId: orgA.id, role: Role.ADMIN },
      async () =>
        tenantPrisma.membership.findUnique({ where: { id: orgBRow!.id } }),
    );
    expect(found).toBeNull();
  });

  it('T-5: DB 복합 FK가 다른 조직의 부모를 가리키는 행을 거부한다', async () => {
    // 원본(비확장) 클라이언트로 orgA 소속 스위트를 만든다.
    const suite = await ctx.prisma.testSuite.create({
      data: {
        organizationId: orgA.id,
        name: '스위트',
        createdById: userId,
      },
    });

    // 서비스 계층을 완전히 우회해, orgB를 자처하며 orgA의 스위트를 부모로 삼는 케이스를 직접 시도한다.
    await expect(
      ctx.prisma.testCase.create({
        data: {
          organizationId: orgB.id,
          suiteId: suite.id,
          title: '크로스 테넌트 케이스',
          steps: [],
          expectedResult: '기대값',
          createdById: userId,
        },
      }),
    ).rejects.toMatchObject({ code: 'P2003' });
  });
});
