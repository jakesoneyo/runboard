// 데모 로그인 계정과 샘플 데이터를 만드는 1회성 스크립트(SPEC.md F8, DATA-MODEL.md 6장 5번).
// 도메인 서비스 메서드를 그대로 호출한다 — DB에 직접 INSERT하지 않는 이유는 감사로그·비정규화
// 카운터·트랜잭션이 실사용 경로와 동일하게 쌓여야 "진짜" 데모가 되기 때문이다.
// 실행: npm run seed:demo (idempotent — admin 계정이 이미 있으면 아무 것도 하지 않는다).
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { BugSeverity, BugStatus, CasePriority, Role } from '@prisma/client';
import type { RunCaseResult } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { AuthService } from '../src/auth/auth.service';
import { BugsService } from '../src/bugs/bugs.service';
import { CasesService } from '../src/cases/cases.service';
import { runWithRequestContext } from '../src/common/context/request-context';
import type { AuthenticatedUser } from '../src/common/decorators/current-user.decorator';
import { InvitationsService } from '../src/organizations/invitations.service';
import { OrganizationsService } from '../src/organizations/organizations.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { RunsService } from '../src/runs/runs.service';
import { SuitesService } from '../src/suites/suites.service';

/** TestCase/BugReport의 steps Json 모양(case.schema.ts caseStepSchema)을 순번대로 채운다. */
function steps(...actions: string[]) {
  return actions.map((action, index) => ({ order: index + 1, action }));
}

interface RunboardQaDeps {
  orgId: string;
  adminId: string;
  adminEmail: string;
  suites: SuitesService;
  cases: CasesService;
  runs: RunsService;
  bugs: BugsService;
}

/**
 * 메인 데모 조직. 스위트 3(중첩 1) · 케이스 10 · 완료 실행 2 · 진행 중 실행 1(일부 PENDING) ·
 * 버그 3(OPEN/IN_PROGRESS/RESOLVED)을 SPEC F8 그대로 채운다.
 * 전체를 한 ALS 컨텍스트 안에서 실행한다 — organizations.service.ts의 create()가 그러듯,
 * tenant.extension.ts는 이 컨텍스트의 organizationId를 모든 쿼리에 자동 주입/검증한다.
 */
async function seedRunboardQa(deps: RunboardQaDeps): Promise<void> {
  await runWithRequestContext(
    {
      userId: deps.adminId,
      actorEmail: deps.adminEmail,
      organizationId: deps.orgId,
      role: Role.ADMIN,
    },
    async () => {
      const authSuite = await deps.suites.create(deps.adminId, {
        name: '인증',
      });
      const loginSuite = await deps.suites.create(deps.adminId, {
        name: '로그인 흐름',
        parentId: authSuite.id,
      });
      const paymentSuite = await deps.suites.create(deps.adminId, {
        name: '결제',
      });

      const createCase = (
        suiteId: string,
        title: string,
        priority: CasePriority,
        expectedResult: string,
        ...actions: string[]
      ) =>
        deps.cases.create(deps.adminId, {
          suiteId,
          title,
          steps: steps(...actions),
          expectedResult,
          priority,
        });

      await createCase(
        authSuite.id,
        '회원가입 - 정상 케이스',
        CasePriority.HIGH,
        '가입 완료 후 자동 로그인된다.',
        '이메일/비밀번호/이름 입력',
        '가입 버튼 클릭',
      );
      await createCase(
        authSuite.id,
        '회원가입 - 이메일 중복 거부',
        CasePriority.MEDIUM,
        '409 에러와 함께 가입이 거부된다.',
        '이미 가입된 이메일로 입력',
        '가입 버튼 클릭',
      );
      await createCase(
        loginSuite.id,
        '로그인 성공',
        CasePriority.CRITICAL,
        'access/refresh 토큰이 발급된다.',
        '올바른 이메일/비밀번호 입력',
        '로그인 버튼 클릭',
      );
      await createCase(
        loginSuite.id,
        '로그인 실패 - 잘못된 비밀번호',
        CasePriority.HIGH,
        '401과 함께 로그인이 거부된다.',
        '잘못된 비밀번호 입력',
        '로그인 버튼 클릭',
      );
      await createCase(
        loginSuite.id,
        '리프레시 토큰 회전',
        CasePriority.HIGH,
        '기존 refresh는 폐기되고 새 토큰 쌍이 발급된다.',
        '/auth/refresh 호출',
      );
      await createCase(
        loginSuite.id,
        '리프레시 재사용 탐지',
        CasePriority.CRITICAL,
        '같은 계열(familyId)의 refresh 토큰이 모두 폐기된다.',
        '이미 폐기된 refresh로 재요청',
      );
      await createCase(
        paymentSuite.id,
        '단건 결제 성공',
        CasePriority.CRITICAL,
        '결제가 완료 상태로 전이된다.',
        '카드 정보 입력',
        '결제 버튼 클릭',
      );
      await createCase(
        paymentSuite.id,
        '결제 실패 - 잔액 부족',
        CasePriority.HIGH,
        '결제가 거부되고 사유가 표시된다.',
        '잔액이 부족한 카드로 결제 시도',
      );
      await createCase(
        paymentSuite.id,
        '결제 취소',
        CasePriority.MEDIUM,
        '결제가 취소 상태로 바뀐다.',
        '완료된 결제 건 취소 요청',
      );
      await createCase(
        paymentSuite.id,
        '환불 처리',
        CasePriority.MEDIUM,
        '환불 완료 알림이 발송된다.',
        '취소된 결제 건 환불 요청',
      );

      // 완료된 실행 1 — 인증 스모크. "회원가입 - 이메일 중복 거부" 케이스만 FAIL로 남겨 버그 1건을 파생시킨다.
      const run1 = await deps.runs.create(deps.adminId, {
        name: '인증 스모크 테스트 v1',
        suiteIds: [authSuite.id, loginSuite.id],
      });
      const failedRunCase1 = await recordAllResults(deps, run1.id, [
        'PASS',
        'FAIL',
        'PASS',
        'PASS',
        'PASS',
        'PASS',
      ]);
      await deps.runs.updateStatus(run1.id, deps.adminId, {
        status: 'COMPLETED',
      });

      // 완료된 실행 2 — 결제 회귀. "결제 실패 - 잔액 부족" 케이스가 FAIL(=실제로는 결제가 되어버림)로 남는다.
      const run2 = await deps.runs.create(deps.adminId, {
        name: '결제 회귀 테스트 v1',
        suiteIds: [paymentSuite.id],
      });
      const failedRunCase2 = await recordAllResults(deps, run2.id, [
        'PASS',
        'FAIL',
        'BLOCKED',
        'PASS',
      ]);
      await deps.runs.updateStatus(run2.id, deps.adminId, {
        status: 'COMPLETED',
      });

      // 진행 중 실행 — 2건만 기록하고 나머지는 PENDING으로 남겨 "지금 돌고 있는 중" 화면을 보여준다.
      const run3 = await deps.runs.create(deps.adminId, {
        name: '인증 스프린트 24 실행',
        suiteIds: [authSuite.id, loginSuite.id],
      });
      await deps.runs.updateStatus(run3.id, deps.adminId, {
        status: 'IN_PROGRESS',
      });
      const run3Cases = await deps.runs.listCases(run3.id, {});
      await deps.runs.recordResult(run3.id, run3Cases[0].id, deps.adminId, {
        result: 'PASS',
      });
      await deps.runs.recordResult(run3.id, run3Cases[1].id, deps.adminId, {
        result: 'FAIL',
        comment: '재현 확인 필요',
      });

      // 버그 3건 — 상태를 OPEN/IN_PROGRESS/RESOLVED로 다르게 남겨 필터·집계 화면이 비어 보이지 않게 한다.
      await deps.bugs.create(deps.adminId, {
        title: '[버그] 이메일 중복 가입 시 500 발생',
        description: '중복 이메일로 가입 요청 시 409 대신 500이 발생한다.',
        stepsToReproduce: steps('이미 가입된 이메일로 회원가입 시도'),
        severity: BugSeverity.MAJOR,
        testRunCaseId: failedRunCase1.id,
      });

      const bug2 = await deps.bugs.create(deps.adminId, {
        title: '[버그] 잔액 부족 결제가 성공 처리됨',
        description: '잔액이 부족한 카드로도 결제가 완료 상태로 바뀐다.',
        stepsToReproduce: steps('잔액 부족 카드로 결제 시도'),
        severity: BugSeverity.CRITICAL,
        testRunCaseId: failedRunCase2.id,
      });
      await deps.bugs.update(deps.adminId, bug2.id, {
        status: BugStatus.IN_PROGRESS,
      });

      const bug3 = await deps.bugs.create(deps.adminId, {
        title: '[버그] 구버전 Safari에서 로그인 버튼 비활성화',
        description: 'Safari 14 이하에서 로그인 버튼 클릭이 되지 않는다.',
        stepsToReproduce: steps(
          'Safari 14에서 로그인 페이지 접속',
          '로그인 버튼 클릭',
        ),
        severity: BugSeverity.MINOR,
      });
      await deps.bugs.update(deps.adminId, bug3.id, {
        status: BugStatus.RESOLVED,
      });
    },
  );
}

/**
 * 실행을 IN_PROGRESS로 돌리고 결과를 위치(position) 순서대로 기록한 뒤 첫 FAIL 케이스를 돌려준다.
 * ponytail: run1/run2가 "IN_PROGRESS 전환 → 순서대로 기록 → FAIL 케이스 추출" 로직을 그대로 반복하므로 공용화했다.
 */
async function recordAllResults(
  deps: RunboardQaDeps,
  runId: string,
  results: RunCaseResult[],
) {
  await deps.runs.updateStatus(runId, deps.adminId, {
    status: 'IN_PROGRESS',
  });
  const runCases = await deps.runs.listCases(runId, {});
  let firstFailed: { id: string } | undefined;
  for (const [index, runCase] of runCases.entries()) {
    const result = results[index] ?? 'PASS';
    const { runCase: updated } = await deps.runs.recordResult(
      runId,
      runCase.id,
      deps.adminId,
      { result },
    );
    if (result === 'FAIL' && !firstFailed) firstFailed = updated;
  }
  if (!firstFailed) {
    throw new Error(`[seed-demo] ${runId} 실행에 FAIL 케이스가 없습니다.`);
  }
  return firstFailed;
}

interface PartnerCorpDeps {
  orgId: string;
  ownerId: string;
  ownerEmail: string;
  suites: SuitesService;
  cases: CasesService;
  runs: RunsService;
}

/**
 * 두 번째 조직. "다른 조직 데이터는 안 보인다"를 데모에서 바로 보여주기 위한 별도 자산 세트
 * (DATA-MODEL.md 6장 5번) — Runboard QA와 겹치지 않는 스위트/케이스/실행을 최소한으로 채운다.
 */
async function seedPartnerCorp(deps: PartnerCorpDeps): Promise<void> {
  await runWithRequestContext(
    {
      userId: deps.ownerId,
      actorEmail: deps.ownerEmail,
      organizationId: deps.orgId,
      role: Role.ADMIN,
    },
    async () => {
      const onboardingSuite = await deps.suites.create(deps.ownerId, {
        name: '온보딩',
      });
      await deps.cases.create(deps.ownerId, {
        suiteId: onboardingSuite.id,
        title: '약관 동의 확인',
        steps: steps('필수 약관 미동의 상태로 다음 버튼 클릭'),
        expectedResult: '다음 단계로 진행되지 않고 안내 문구가 표시된다.',
        priority: CasePriority.MEDIUM,
      });
      await deps.cases.create(deps.ownerId, {
        suiteId: onboardingSuite.id,
        title: '초기 설정 마법사 완료',
        steps: steps('회사 정보 입력', '완료 버튼 클릭'),
        expectedResult: '대시보드로 이동한다.',
        priority: CasePriority.LOW,
      });

      const run = await deps.runs.create(deps.ownerId, {
        name: '온보딩 검증 v1',
        suiteIds: [onboardingSuite.id],
      });
      await deps.runs.updateStatus(run.id, deps.ownerId, {
        status: 'IN_PROGRESS',
      });
      const runCases = await deps.runs.listCases(run.id, {});
      await deps.runs.recordResult(run.id, runCases[0].id, deps.ownerId, {
        result: 'PASS',
      });
    },
  );
}

async function main(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: false });
  // app.init()만으로도 RunsGateway.afterInit()이 실행돼 소켓 네임스페이스가 등록된다(HTTP listen 불필요) —
  // RunsService.recordResult 등이 커밋 후 RunEventsService로 emit하는데, 네임스페이스가 없으면 예외가 난다.
  await app.init();

  const prisma = app.get(PrismaService);
  const alreadySeeded = await prisma.user.findUnique({
    where: { email: 'admin' },
  });
  if (alreadySeeded) {
    console.log('[seed-demo] admin 계정이 이미 있습니다 — 스킵합니다.');
    await app.close();
    return;
  }

  const auth = app.get(AuthService);
  const orgs = app.get(OrganizationsService);
  const invitations = app.get(InvitationsService);
  const suites = app.get(SuitesService);
  const cases = app.get(CasesService);
  const runs = app.get(RunsService);
  const bugs = app.get(BugsService);

  // 계정 2개 — admin은 CLAUDE.md 데모 계정 규정(로그인 스키마의 'admin' 리터럴 우회 대상),
  // 파트너 쪽 소유자는 일반 사용자와 동일하게 실이메일로 가입한다.
  const { user: admin } = await auth.register({
    email: 'admin',
    password: 'admin',
    name: '관리자',
  });
  const { user: partnerOwner } = await auth.register({
    email: 'owner@partnercorp.example.com',
    password: 'partner-demo-pw',
    name: 'Partner Corp 관리자',
  });

  // 조직 A(Runboard QA) — admin이 ADMIN. 데모의 메인 무대.
  const org1 = await runWithRequestContext(
    { userId: admin.id, actorEmail: admin.email },
    () => orgs.create(admin.id, { name: 'Runboard QA' }),
  );
  await seedRunboardQa({
    orgId: org1.id,
    adminId: admin.id,
    adminEmail: admin.email,
    suites,
    cases,
    runs,
    bugs,
  });

  // 조직 B(Partner Corp) — partnerOwner가 ADMIN.
  const org2 = await runWithRequestContext(
    { userId: partnerOwner.id, actorEmail: partnerOwner.email },
    () => orgs.create(partnerOwner.id, { name: 'Partner Corp' }),
  );
  await seedPartnerCorp({
    orgId: org2.id,
    ownerId: partnerOwner.id,
    ownerEmail: partnerOwner.email,
    suites,
    cases,
    runs,
  });

  // admin을 Partner Corp에 VIEWER로 초대 → 수락 — 같은 사람이 조직마다 다른 Role을 갖는 걸 보여준다.
  const invitation = await runWithRequestContext(
    {
      userId: partnerOwner.id,
      actorEmail: partnerOwner.email,
      organizationId: org2.id,
      role: Role.ADMIN,
    },
    () =>
      invitations.create(partnerOwner.id, {
        email: 'admin',
        role: Role.VIEWER,
      }),
  );
  // invitations.service.ts는 원문 토큰을 inviteUrl 쿼리스트링에만 실어 돌려준다 — accept()에 필요한
  // 원문 토큰을 얻는 유일한 경로다(FRONTEND_URL 미설정 시 상대경로라 base는 아무 값이나 줘도 무방).
  const inviteToken = new URL(
    invitation.inviteUrl,
    'http://localhost',
  ).searchParams.get('token');
  if (!inviteToken) {
    throw new Error('[seed-demo] 초대 토큰을 파싱하지 못했습니다.');
  }
  await runWithRequestContext(
    { userId: admin.id, actorEmail: admin.email },
    () =>
      invitations.accept(
        { id: admin.id, email: admin.email } as AuthenticatedUser,
        inviteToken,
      ),
  );

  // 정상 로그인 1회 — AUTH_LOGIN_SUCCEEDED 감사로그를 실제 인증 경로로 남긴다(우회 없음, bcrypt 비교 통과).
  await auth.login({ email: 'admin', password: 'admin' });

  await app.close();
  console.log(
    '[seed-demo] 완료: admin/admin, Runboard QA(ADMIN) · Partner Corp(VIEWER)',
  );
}

main().catch((err: unknown) => {
  console.error('[seed-demo] 실패:', err);
  process.exit(1);
});
