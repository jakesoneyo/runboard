# REVIEW — runboard 배포 전 최종 검수

검수 시점: 2026-08-31 ｜ 대상: main `5af4f0b` (C1~C8 완료, 배포 전)
검수 방식: 설계문서(SPEC/API/ARCHITECTURE/DATA-MODEL) 재대조 + 코드 직접 추적 + **빌드·테스트·Docker를 검수자가 직접 실행**(구현 보고를 신뢰하지 않음)

## 0. 직접 실행해 확인한 사실

| 항목                               | 명령                                         | 결과                                                       |
| ---------------------------------- | -------------------------------------------- | ---------------------------------------------------------- |
| 백엔드 빌드                        | `backend: npm run build`                     | ✅ exit 0                                                  |
| 프론트 빌드                        | `frontend: npm run build`                    | ✅ exit 0 (단일 청크 870.74 kB / gzip 258.82 kB 경고)      |
| 백엔드 단위+통합 테스트            | `backend: npm test` (Testcontainers 포함)    | ✅ unit 22/22, e2e 113/113, exit 0                         |
| 린트                               | `frontend: oxlint`, `backend: npx eslint`    | ✅ 0 errors (수정 없이)                                    |
| Docker 이미지 빌드                 | `docker build -f backend/Dockerfile backend` | ✅ exit 0                                                  |
| **프로덕션 컨테이너 실기동**       | 이미지 + 임시 Postgres 컨테이너              | ✅ `prisma migrate deploy` 성공 → `/health` 200 (DB ping)  |
| DIRECT_URL 없이 기동               | 위와 동일, `DIRECT_URL` 만 제거              | ❌ `datasource.url property is required` → 즉시 종료       |
| CORS_ORIGINS 없이 임의 Origin 요청 | `curl -H "Origin: https://evil.example.com"` | ⚠️ `Access-Control-Allow-Origin: https://evil.example.com` |
| 빈 프로덕션 DB에서 데모 로그인     | `POST /api/auth/login {admin/admin}`         | ❌ 401 `AUTH_INVALID_CREDENTIALS` (시드 안 됨)             |
| 같은 결과 2회 기록 시 카운터       | 임시 e2e 스펙 작성 후 실행(검수 후 삭제)     | ❌ `total:1, passed:2` — 카운터 이중 증가 재현             |

---

## 🔴 배포 전 반드시 고쳐야 함

### 🔴-1. 결과 재기록 시 카운터가 이중 증가한다 (진행률/통과율 200% 표시)

- **파일/서브시스템**: `backend/src/runs/runs.service.ts:391-404` (`applyCounterShift`) — runs 도메인(백엔드 단독)
- **증상**: 같은 `RunCase`에 **같은 결과를 두 번 기록**하면 해당 카운터가 +1 된다. 실측: `totalCount:1 / passedCount:2` → `progress = 2.0`, `passRate = 2.0`.
- **원인**: 이전 결과와 새 결과의 카운터 필드가 같을 때 객체 키가 덮어써진다.

  ```ts
  const data: Prisma.TestRunUpdateInput = {};
  if (prevField) data[prevField] = { decrement: 1 };
  if (nextField) data[nextField] = { increment: 1 }; // prevField === nextField면 decrement가 사라진다
  ```

  주석에는 "같은 필드로 상쇄되는 경우도 자연히 처리된다"고 적혀 있으나 실제로는 상쇄되지 않는다.

- **UI에서 즉시 재현 가능**: `frontend/src/components/runs/ExecCaseRow.tsx:41-52` 는 동일 결과 재클릭을 막지 않는다(코멘트만 수정하는 경우도 동일 경로). 면접관이 PASS를 두 번 누르면 대시보드 통과율이 깨진다.
- **수정 지시**:
  1. `applyCounterShift`에서 `prevField === nextField`면 증감을 아예 하지 않도록 조기 반환.
  2. (권장) 카운터 증감을 누적 방식으로 계산 — `const delta: Record<CounterField, number>` 를 만들어 `-1/+1`을 합산한 뒤 0이 아닌 필드만 `increment`로 전달.
  3. 회귀 테스트 추가: `backend/test/runs.e2e-spec.ts` 에 "같은 결과 2회 기록 후 `passedCount === 1`, `progress <= 1`" 케이스. (현재 테스트는 `FAIL→PASS`처럼 **서로 다른 필드** 전이만 검증해서 이 버그를 통과시킨다: `test/runs.e2e-spec.ts:269`)
  4. (선택) `computeCounters`에서 `progress`/`passRate`를 0~1로 clamp — 방어선 하나 더.

### 🔴-2. `render.yaml` 에 `DIRECT_URL` 이 없어 컨테이너가 기동 즉시 죽는다

- **파일/서브시스템**: `render.yaml:12-18`, `backend/Dockerfile:29`, `backend/prisma.config.ts:14-16` — 배포 인프라
- **근거(실측)**: `Dockerfile` CMD가 `npx prisma migrate deploy && node dist/main.js`인데, `prisma.config.ts`의 `datasource.url`은 **`DIRECT_URL`만** 읽는다. `DIRECT_URL` 없이 이미지를 실행하면 `Error: The datasource.url property is required in your Prisma config file when using prisma migrate deploy.`로 종료 → Render에서 배포 실패/크래시 루프.
- **수정 지시**: `render.yaml` `envVars`에 아래를 추가한다(전부 `sync: false`, 값은 Render 대시보드 입력).
  - `DIRECT_URL` — Neon **직결(non-pooled)** 문자열 ← 이것이 없으면 기동 불가
  - `CORS_ORIGINS` — 🔴-3 참고
  - `FRONTEND_URL` — 초대 링크 절대 URL 조립용(`backend/src/organizations/invitations.service.ts:148-151`, 없으면 상대 경로만 반환)
  - `PORT` 는 Render가 주입하므로 불필요(`backend/src/main.ts:34`에서 `process.env.PORT` 사용 확인)

### 🔴-3. CORS가 프로덕션에서 임의 오리진을 반사 허용한다

- **파일/서브시스템**: `backend/src/main.ts:32`, `backend/src/runs/runs.gateway.ts:35`, `render.yaml` — 배포 설정/보안
- **근거(실측)**: `origin: process.env.CORS_ORIGINS?.split(',') ?? true` 이고 `render.yaml`에 `CORS_ORIGINS`가 없다 → 실제 응답에 `Access-Control-Allow-Origin: https://evil.example.com`이 그대로 반사됐다. WebSocket 게이트웨이도 동일한 fallback을 쓴다.
- **영향**: 토큰이 쿠키가 아니라 `localStorage` + `Authorization` 헤더라 즉시 계정 탈취로 이어지진 않지만, "공개 API를 아무 사이트나 브라우저에서 호출 가능"한 상태로 배포된다. 면접에서 지적당하기 딱 좋은 지점.
- **수정 지시**:
  1. `render.yaml`에 `CORS_ORIGINS` 추가 → 배포 후 확정된 Vercel 도메인(`https://runboard-xxx.vercel.app`, 커스텀 도메인 있으면 함께 콤마 구분)으로 설정.
  2. 프로덕션에서 값이 비었을 때 `true`(전체 허용)로 떨어지지 않게 방어: `NODE_ENV === 'production'`이면 `CORS_ORIGINS` 필수로 하고 없으면 부팅 실패시키거나 빈 배열로 처리.
  3. Vercel 쪽에는 `VITE_API_URL`(`https://<render-host>/api`), `VITE_WS_URL`(`https://<render-host>`)을 **빌드 전에** 환경변수로 등록해야 한다(Vite는 빌드타임 치환).

### 🔴-4. 프로덕션 DB 시드 절차가 없어 "회원가입 없이 둘러보기"가 401로 실패한다

- **파일/서브시스템**: `backend/scripts/seed-demo.ts`, `README.md:103-125`, `render.yaml` — 배포 운영 절차
- **근거(실측)**: 마이그레이션만 적용된 빈 DB에 `admin/admin`으로 로그인하면 `401 AUTH_INVALID_CREDENTIALS`. Dockerfile CMD는 `migrate deploy`만 하고 시드는 하지 않으며, Render 무료 플랜엔 셸이 없다.
- **영향**: CLAUDE.md 데모 계정 규정(면접관이 회원가입 없이 완성 화면을 봐야 함)의 핵심이 라이브에서 깨진다. SPEC US-1 미충족.
- **수정 지시**(택1, 1번 권장):
  1. 배포 직후 **로컬에서 Neon을 향해 1회 실행**: `cd backend && DATABASE_URL='<neon-pooled>' DIRECT_URL='<neon-direct>' npm run seed:demo` — 스크립트가 idempotent(`scripts/seed-demo.ts:330-337`)라 재실행 안전. 이 단계를 README "배포" 절과 배포 체크리스트에 **명시적으로** 남길 것.
  2. Render의 pre-deploy command에 시드를 걸거나 CMD를 `migrate deploy && seed:demo && node dist/main.js`로 바꾼다 — 단 시드는 `ts-node` + devDependency가 필요해 현재 프로덕션 이미지(`npm prune --omit=dev`)에서는 그대로 동작하지 않는다. 이 경로를 택하면 시드를 빌드 산출물(`dist`)로 함께 컴파일해야 한다.
- 추가로 README `라이브` 배지(`README.md:8`)와 Swagger URL(`README.md:129`)을 배포 후 실제 URL로 갱신.

### 🔴-5. 초대 링크가 데드링크다 — 초대 수락 화면·API 호출이 프론트에 없다

- **파일/서브시스템**: `frontend/src/App.tsx:20-37`(라우트 없음), `frontend/src/features/invitations/api.ts`(accept 호출 없음), `frontend/src/pages/MembersPage.tsx:185-187`(링크 노출) — 프론트 단독(백엔드는 이미 완성)
- **근거**: 백엔드는 `POST /api/invitations/accept`를 제공하고(`backend/src/organizations/invitations.controller.ts:60-71`), 초대 URL은 `${FRONTEND_URL}/invitations/accept?token=...`로 만들어진다(`invitations.service.ts:148-151`). 그런데 프론트에는 `/invitations/accept` 라우트가 없어 `path="*"` → `/`로 리다이렉트된다. UI는 "링크를 복사해 전달하세요"라고 안내만 한다.
- **영향**: SPEC US-2("초대 링크 생성 → 다른 계정이 수락 → Membership 생성")가 제품에서 완결되지 않는다. 데모 중 링크를 눌러보면 아무 일도 일어나지 않는다.
- **수정 지시**(택1):
  1. `/invitations/accept` 페이지 추가 — `useSearchParams`로 token을 읽어 `POST /invitations/accept` 호출 → 성공 시 해당 org로 전환 후 대시보드 이동, 404/409는 사용자 문구로 표시. 미로그인 상태면 로그인 후 돌아오도록 리다이렉트 보존.
  2. (시간이 없다면) 초대 UI 문구를 "백엔드 API로 수락(Swagger에서 시연)"으로 바꾸고 README 비범위에 명시 — 단 SPEC US-2를 함께 수정해야 문서-코드 일관성이 유지된다.

---

## 🟡 고치면 좋음 (배포는 막지 않음)

- **`JWT_REFRESH_SECRET` 이 실제로는 안 쓰인다** — `backend/.env.example:4`. refresh는 JWT가 아니라 `randomBytes(32)` + SHA-256 저장 방식이다(`backend/src/auth/auth.service.ts:181-195`). 설계상 더 나은 선택이므로 **코드가 아니라 `.env.example`을 지우고** README/ARCHITECTURE에 "refresh는 불투명 토큰"이라고 한 줄 남기는 게 낫다(면접 어필 포인트).
- **API.md `AUTH_TOKEN_EXPIRED` 코드는 실제로 반환되지 않는다** — `API.md:34` vs `backend/src/common/filters/all-exceptions.filter.ts:21-27`. 만료 access 토큰은 Passport가 던지는 401이 `code: "UNAUTHORIZED"`로 나간다. 문서에서 빼거나 JwtAuthGuard에서 만료를 구분해 코드 부여.
- **API.md 8장의 WS `error` 이벤트 미구현** — 게이트웨이는 실패를 ack(`{ok:false, code}`)로만 돌려준다(`backend/src/runs/runs.gateway.ts:72,75,107`). 문서에서 제거하거나 실제 emit 추가.
- **API.md `run:progress.updated` 발생 시점 불일치** — 문서는 "결과 기록·**실행 상태 변경** 직후", 구현은 결과 기록에서만 emit(`backend/src/runs/runs.service.ts:258`, 상태 전이는 `:289-298`에서 `run:status.changed`만). 문서를 구현에 맞추는 쪽이 싸다.
- **커서 페이지네이션의 정렬 키와 커서 키가 다르다** — `orderBy: createdAt/updatedAt` + `cursor: {id}` 조합: `backend/src/audit/audit-query.service.ts:29-31`, `runs.service.ts:43-45`, `cases.service.ts:48-50`, `bugs.service.ts:47-49`. 같은 타임스탬프 레코드가 여러 개면(한 트랜잭션에서 감사로그가 여러 건 생기는 경우 실제로 발생) 페이지 경계에서 중복/누락 가능. `orderBy: [{ createdAt: 'desc' }, { id: 'desc' }]`로 타이브레이커 추가 권장.
- **버그 담당자(`assigneeId`)에 조직 밖 사용자 id를 넣을 수 있다** — `backend/src/bugs/bugs.service.ts:137`, `dto/update-bug.schema.ts`. 실행 배정자는 멤버십을 강제하는데(`runs.service.ts:407-422`) 버그 담당자만 비대칭이다. 데이터 유출은 아니지만 "모든 외부 입력 검증"(CLAUDE.md) 기준에선 구멍. `assertAssigneesAreMembers`와 동일한 검증 재사용 권장.
- **실행 생성 시 `suiteIds`가 하위 스위트 케이스를 포함하지 않는다** — `backend/src/runs/runs.service.ts:122-134`는 `suiteId in suiteIds`만 조회하는데, `dto/create-run.schema.ts` 상단 주석은 "그 스위트의 모든 케이스"라고 말한다. 시드가 부모·자식 스위트를 둘 다 나열하는 것(`scripts/seed-demo.ts:156`)이 이 한계의 흔적. 하위 스위트까지 펼치거나, 주석/문서를 실제 동작(직속 케이스만)으로 정정.
- **미사용 의존성** — `class-validator`, `class-transformer`가 `backend/package.json`에 있으나 `src` 어디에서도 import되지 않는다(검증은 전부 Zod). ponytail 기준 제거 대상.
- **로그인 브루트포스 방어 없음** — 공개 데모라 `admin/admin`이 알려진 상태에서 무제한 시도가 가능(감사로그 `AUTH_LOGIN_FAILED`만 쌓인다). 새 의존성을 피하려면 README "향후 과제"에 명시, 넣는다면 `@nestjs/throttler` 로그인 라우트 한정 적용.
- **CI의 `npm run lint`가 `eslint --fix`다** — `backend/package.json` lint 스크립트 + `.github/workflows/ci.yml:23`. CI에서 자동 수정 후 통과하므로 린트 위반을 실제로 잡지 못한다. CI에서는 `eslint "{src,test}/**/*.ts"`(--fix 없이) 사용 권장.
- **프론트 단일 청크 870 kB** — 라우트 단위 `React.lazy` 분할이면 첫 로드 체감이 개선된다(Recharts가 큰 몫). 데모 첫인상에만 영향.
- **README에 데모 GIF/라이브 URL 없음** — SPEC 6장 성공 기준("README에 mermaid 아키텍처 + 데모 GIF")의 GIF 항목 미충족. 배포 직후 실시간 2브라우저 동기화 GIF 1개가 이 프로젝트에서 가장 강한 증거다.
- **`AuditLog.metadata`에 `Object.keys(dto)`를 그대로 필드 목록으로 쓴다** — `cases.service.ts:130-134`, `bugs.service.ts:148-152`. 지금은 DTO가 화이트리스트라 안전하지만, 나중에 DTO에 민감 필드가 늘면 그대로 감사로그에 새는 구조다. 명시적 필드 배열로 좁히는 편이 안전.

---

## 🟢 잘된 점 (면접에서 그대로 어필 가능)

- **멀티테넌시 3계층이 문서상 주장이 아니라 실제로 구현돼 있다** — 가드(`common/guards/org-context.guard.ts:36-47`, 비멤버·비UUID를 모두 404로 수렴) → Prisma Extension(`prisma/tenant.extension.ts:89-107`, 화이트리스트 모델은 컨텍스트 없으면 500 `TENANT_CONTEXT_MISSING`, `create`에서 body의 `organizationId`를 컨텍스트 값으로 덮어씀) → DB 복합 FK(`prisma/migrations/20260827131827_tenant_integrity/migration.sql`에서 단일 FK를 DROP 후 `(parentId, organizationId)`·`(testRunCaseId, organizationId)` 복합 FK로 교체). 세 계층 모두 코드로 확인했다.
- **비확장(raw) Prisma를 쓰는 곳이 4곳뿐이고 전부 정당하다** — 조직 확정 전 멤버십 조회(가드), 전역 아이덴티티(auth), 토큰만으로 조직을 알아내는 초대 수락, WS 페이로드용 사용자 이름 조회. 각 지점에 "왜 여기서만 예외인가" 주석이 붙어 있다(`runs.service.ts:29-31`, `invitations.service.ts:22-23`).
- **감사로그를 도메인 트랜잭션 밖에서 못 쓰게 타입으로 막았다** — `prisma/tenant-transaction.service.ts:14-27`의 브랜드 타입. "감사로그 누락"을 코드리뷰가 아니라 타입 시스템이 막는 설계는 신입 포폴에서 보기 드문 강점.
- **refresh 회전 + 재사용 탐지, 그리고 폐기 트랜잭션 분리** — `auth/auth.service.ts:112-133`. "가족 전체 폐기는 throw 이후에도 커밋돼 있어야 한다"는 주석은 실제로 겪은 버그 기록이라 면접 스토리로 강하다. 프론트도 동시 401 경합으로 계열이 폐기되는 문제를 in-flight refresh 공유로 막았다(`frontend/src/lib/api-client.ts:26-49`).
- **WebSocket이 REST 인가를 재사용하고, emit은 커밋 이후에만** — `runs.gateway.ts:93-113`(`assertReadable`로 룸 조인 인가) + `runs.service.ts:184-258`(트랜잭션 반환 후 emit) + `run-events.service.ts:1-3`(이 파일은 트랜잭션을 아예 모른다). "룸 이름만 알면 훔쳐본다"와 "롤백된 상태를 방송한다" 두 사고를 구조로 차단.
- **데모 계정 규정을 정확히 지켰다** — 우회는 로그인 스키마의 `value === 'admin'` 리터럴 하나뿐(`auth/dto/login.schema.ts:8-16`), 회원가입은 실이메일 강제(`register.schema.ts:6`), 비밀번호는 bcrypt 정상 비교(`auth.service.ts:61-63`), 인증 우회 엔드포인트 없음, 버튼 문구/보조 설명이 CLAUDE.md와 문자 단위로 일치(`frontend/src/pages/LoginPage.tsx:259,262`). 시드도 실제 `AuthService.register` + `login`을 호출해 감사로그까지 정상 경로로 남긴다(`scripts/seed-demo.ts:349-422`).
- **N+1 회피가 설계-코드-테스트로 이어진다** — 대시보드 4쿼리 고정(`dashboard/dashboard.service.ts:29-69`, 관계 include 대신 select로 쿼리 예산 유지), 스위트 트리는 findMany 1회 + 인메모리 조립(`suites/lib/assemble-suite-tree.ts`), 실제 SQL 왕복 수를 세는 테스트 유틸(`test/support/query-counter.ts`)까지 존재.
- **인덱스가 실제 쿼리 패턴과 맞는다** — `memberships(userId, organizationId)` 유니크(요청마다 도는 핫패스), `test_run_assignees` PK가 곧 배정 확인 룩업, 감사로그의 4개 복합 인덱스가 필터 4종과 1:1(`prisma/schema.prisma:161-163, 298-300, 348-352`).
- **프론트 캐시가 조직 스코프로 강제된다** — `frontend/src/lib/query-keys.ts:1-13`. 조직 전환 시 이전 테넌트 데이터가 한 프레임이라도 보이는 사고를 키 설계로 차단하고, 이유를 주석에 남겼다.
- **테스트가 실제로 그린이다(검수자 재현)** — 단위 22 + Testcontainers 통합 113, 스펙 파일마다 독립 컨테이너(`test/support/test-app.ts:30-50`)로 격리, 배포와 동일한 `prisma migrate deploy`로 스키마 적용.
- **프로덕션 이미지가 실제로 뜬다** — 임시 Postgres에 붙여 마이그레이션 자동 적용 → `/health` 200(DB ping 포함)까지 검수자가 직접 확인. Dockerfile의 npm 버전 고정 주석(`backend/Dockerfile:5-11`)은 원인 분석까지 남아 있어 문서 품질이 좋다.
- **주석 규칙 준수** — 파일 상단 역할 1~2줄, 공개 메서드는 "왜"와 예외 중심, 비자명 로직(트랜잭션 경계·테넌트 주입·LWW)에만 인라인. 자명한 주석은 발견되지 않았다.
- **README가 면접관 관점으로 쓰였다** — 문제의식 → 3계층 격리 mermaid → 실시간 시퀀스 → 비범위 14줄(이유 포함) → 향후 과제 5개. 특히 "RLS를 왜 안 썼나", "Redis adapter가 언제 필요한가"가 트레이드오프로 정리돼 있어 질문을 유도한다.

---

## 배포 판정

**현 상태로는 배포 승인 불가.** 🔴 5건(runs 카운터 버그 / `DIRECT_URL` 누락 / CORS 전체 허용 / 프로덕션 시드 절차 / 초대 수락 화면)을 먼저 해소해야 한다.

서브시스템이 서로 겹치지 않으므로 병렬 처리 가능:

| blocker | 서브시스템                                  | 다른 blocker와 파일 충돌 |
| ------- | ------------------------------------------- | ------------------------ |
| 🔴-1    | 백엔드 runs (+ runs e2e 테스트)             | 없음                     |
| 🔴-2    | `render.yaml`                               | 🔴-3과 같은 파일         |
| 🔴-3    | `render.yaml` + `backend/src/main.ts`       | 🔴-2와 같은 파일         |
| 🔴-4    | `README.md` + 배포 절차(코드 변경 최소)     | 없음                     |
| 🔴-5    | 프론트 라우트/페이지/`features/invitations` | 없음                     |

(🔴-2·🔴-3은 같은 `render.yaml`을 건드리므로 한 작업으로 묶는 편이 안전하다.)
수정 후 재검수 필요 항목: `backend: npm test`(카운터 회귀 테스트 포함) · 프론트 빌드 · 프로덕션 컨테이너 기동 · 배포 후 `/health`와 데모 로그인 1회.

**최종 배포 결정은 사람이 한다.**
