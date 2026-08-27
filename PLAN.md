# PLAN — Runboard 구현 계획

L티어(2~3일). **한 청크 = implementer(Sonnet) 서브에이전트 1회 호출** 단위로 묶었다(콜드스타트 오버헤드 최소화).
각 청크는 **테스트 먼저 → 구현 → 리팩터** 순서. 청크 끝에서 `npm test`·`npm run build` 그린이 아니면 다음 청크로 넘어가지 않는다.

> 선행 문서: [SPEC.md](./SPEC.md) · [ARCHITECTURE.md](./ARCHITECTURE.md) · [DATA-MODEL.md](./DATA-MODEL.md) · [API.md](./API.md) · [UBIQUITOUS_LANGUAGE.md](./UBIQUITOUS_LANGUAGE.md)
> implementer에게는 **해당 청크 섹션 + 위 5개 문서 경로**만 주면 된다.

---

## 청크 지도

| #   | 청크                               | 산출 핵심                                          | 예상 | 사람 개입                  |
| --- | ---------------------------------- | -------------------------------------------------- | ---- | -------------------------- |
| C1  | 백엔드 부트스트랩 + 인증           | Nest 골격, Prisma 스키마, JWT + refresh 회전       | 3~4h | –                          |
| C2  | 테넌시 코어 + RBAC + 감사기반      | ALS·Prisma Extension·가드·조직/멤버/초대 API       | 4~5h | –                          |
| C3  | 스위트 · 케이스                    | 트리 CRUD, 케이스 CRUD, 감사로그 연결              | 2~3h | –                          |
| C4  | 실행 + WebSocket 실시간            | 스냅샷 생성, 결과 기록, 게이트웨이·룸·브로드캐스트 | 5~6h | –                          |
| C5  | 버그 + 대시보드 + 감사조회         | 버그 초안/CRUD, 집계 API, 감사로그 조회            | 2~3h | –                          |
| C6  | 프론트 기반                        | 라우팅·인증·조직 전환·스위트/케이스 화면           | 4~5h | **디자인 시안 선택(선행)** |
| C7  | 프론트 실행 실시간 + 버그·대시보드 | 소켓 훅, 실행 보드, 차트                           | 4~5h | –                          |
| C8  | 시드 · 문서 · 배포                 | 데모 시드, README, Render/Vercel/Neon 라이브       | 2~3h | **배포 승인**              |

---

## C1 — 백엔드 부트스트랩 + 인증

**목표**: 실행되는 Nest 앱 + 마이그레이션된 DB + 로그인/리프레시가 테스트로 증명된 상태.

1. 스캐폴드: `backend/` Nest 11(TS), `frontend/`는 빈 자리만. 워크스페이스 템플릿 복사 — `.claude/templates/nest-vite/{Dockerfile,ci.yml,render.yaml,vercel.json}`.
2. Prisma: DATA-MODEL.md 3장 스키마 전체 입력 → **`npx prisma validate` 먼저 통과시킬 것**(복합 FK DSL 한계 확인, 실패 시 DATA-MODEL.md 1장 주의사항대로 단일 FK + SQL 보강으로 전환) → `migrate dev --name init` → `--name tenant_integrity --create-only`로 6장 SQL 추가.
3. 공통 인프라: `ZodValidationPipe`, `AllExceptionsFilter`(에러 포맷·404/403 정책), Pino + requestId, `@nestjs/swagger` 부트스트랩(`/api/docs`), `GET /health`(DB ping).
4. **테스트 먼저**: `auth.service.spec.ts`(bcrypt 비교, 잘못된 비번 거부, `admin` 리터럴만 이메일 검증 우회, 다른 비이메일 문자열은 400), `auth.e2e-spec.ts`(회원가입→로그인→refresh 회전→구 refresh 재사용 시 401 + 계열 폐기).
5. 구현: `AuthModule`(register/login/refresh/logout/me), `JwtStrategy`, RefreshToken 해시 저장·회전·재사용 탐지.

**DoD**: `/health` 200, Swagger에 auth 엔드포인트 노출, 위 스펙 그린, Docker 빌드 성공.
**커밋 예**: `chore: NestJS + Prisma 스캐폴드`, `feat: JWT 인증과 리프레시 토큰 회전`, `test: 리프레시 재사용 탐지 e2e`

---

## C2 — 테넌시 코어 + RBAC + 감사로그 기반 (이 프로젝트의 심장)

**목표**: "조직 경계는 뚫을 수 없다"를 통합테스트로 증명. 조직/멤버/초대 API 완성.

1. **테스트 먼저** (Testcontainers 세팅 포함): 아래 T-1 ~ T-12 중 조직/멤버 관련 전부를 먼저 빨간 상태로 작성.
2. `common/context/request-context.ts` — Node 내장 `AsyncLocalStorage`(추가 의존성 없음).
3. `prisma/tenant.extension.ts` — `$extends({ query: { $allModels } })`로 조직 스코프 자동 주입·검증. 컨텍스트 없으면 **예외**(조용한 전체 조회 금지). 전역 모델(`User`, `RefreshToken`) 화이트리스트. 시드/인증용 원본 클라이언트는 `$system`으로 분리.
4. 가드 체인: `JwtAuthGuard` → `OrgContextGuard`(Membership 조회, 없으면 404) → `RolesGuard`(`@RequireRole()`), Swagger에 요구 역할 표기.
5. `AuditService.record(tx, ...)` — 트랜잭션 인자 필수 시그니처(트랜잭션 밖 호출이 타입 레벨에서 어색하도록). actor·org·ip는 ALS에서 자동 주입, `actorEmail` 스냅샷 저장, metadata는 화이트리스트 diff.
6. API: `/orgs` CRUD, 멤버 목록·역할 변경·제거(마지막 ADMIN 보호), 초대 생성/조회/폐기/수락.

**DoD**: T-1~T-12 그린. 서비스 코드 어디에도 손으로 쓴 `where: { organizationId }`가 없어도 격리가 성립함을 테스트가 증명.
**커밋 예**: `feat: AsyncLocalStorage 요청 컨텍스트와 Prisma 테넌트 확장`, `feat: 조직 스코프 RBAC 가드`, `feat: 트랜잭션 내부 감사로그 기록`, `test: 크로스 테넌트 접근 차단 통합테스트`

---

## C3 — 스위트 · 케이스

1. **테스트 먼저**: 트리 깊이 4단계 거부, 순환 parentId 거부, 스위트 삭제 시 하위 cascade, QA_LEAD 미만 쓰기 403, 케이스 수정 시 감사로그 metadata에 변경 필드만 기록.
2. 구현: 스위트 트리 조회(쿼리 1회로 평면 조회 후 메모리 조립 — N+1 금지), 케이스 CRUD, `steps` Zod 스키마 공유.
3. 목록 응답에서 `steps` 제외(`select` 명시).

**DoD**: 위 스펙 그린 + Swagger 반영.
**커밋 예**: `feat: 테스트 스위트 트리 CRUD`, `feat: 테스트 케이스 CRUD와 변경 감사`

---

## C4 — 실행 + WebSocket 실시간 (가장 큰 청크)

1. **테스트 먼저**
   - 실행 생성 시 선택 케이스가 **RunCase 스냅샷**으로 복사되고, 이후 원본 케이스 수정이 스냅샷에 반영되지 않음
   - 결과 기록 시 카운터가 정확히 이동(PENDING→FAIL→PASS 연속 변경 후에도 합계 = total)
   - 미배정 TESTER 403(`RUN_NOT_ASSIGNED`), QA_LEAD는 배정 없이 200, VIEWER 403
   - COMPLETED 실행에 기록 시 409
   - 게이트웨이: 남의 조직 `runId`로 `run:join` 시 거부, 정상 조인 후 다른 클라이언트의 REST 기록이 이벤트로 도착(소켓 e2e)
2. 구현: `RunsService`(트랜잭션 3쿼리 고정), `RunAssignmentGuard`, `RunsGateway`(핸드셰이크 JWT, 룸 인가에 서비스 인가 로직 재사용), `RunEventsService`(**커밋 후 emit**).
3. 상태 전이 규칙 + `bug-draft` 엔드포인트(스냅샷 → 초안).

**DoD**: 소켓 e2e 포함 그린. 커밋 전 롤백 시 이벤트가 나가지 않음을 테스트로 확인(T-16).
**커밋 예**: `feat: 테스트 실행 스냅샷 생성`, `feat: 실행 결과 기록과 카운터 원자 갱신`, `feat: socket.io 실행 룸 실시간 브로드캐스트`, `test: 동시 기록 실시간 반영 e2e`

---

## C5 — 버그 + 대시보드 + 감사로그 조회

1. **테스트 먼저**: 타 조직 `testRunCaseId`로 버그 생성 시 404, TESTER 생성 가능·상태 변경 403, 대시보드 수치가 조직별로 분리, 감사로그 조회는 ADMIN 외 403 + 커서 페이지네이션 동작.
2. 구현: 버그 CRUD, `dashboard/summary`(3~4쿼리 고정 — 테스트에서 쿼리 수 확인), `pass-rate-trend`(카운터만 읽기), 감사로그 필터 조회.

**DoD**: 위 스펙 그린. 백엔드 기능 100% 완료 상태.
**커밋 예**: `feat: 버그 리포트와 실행 케이스 연동`, `feat: 조직 대시보드 집계 API`, `feat: 감사로그 조회 API`

---

## C6 — 프론트 기반 (디자인 시안 선택 후 시작)

1. Vite + React + TS + Tailwind v4 + Zustand + TanStack Query + Axios + lucide-react 셋업, 라우터.
2. 인증: 로그인/회원가입 화면, **데모 로그인 버튼** — 문구 고정(`회원가입 없이 둘러보기` / `회원가입 없이 체험해 볼 수 있습니다.`), axios 인터셉터(401 → refresh 1회 재시도 + 동시요청 큐잉), 토큰 스토어.
3. 조직 전환기: `orgStore`, **모든 쿼리 키 선두에 `orgId`** (조직 전환 시 캐시 오염 금지 — 이 규칙을 코드 주석으로 남길 것).
4. 화면: 앱 셸(사이드바·역할 배지), 스위트 트리 + 케이스 목록/편집, 멤버·초대 관리(ADMIN), 역할별 UI 게이팅(버튼 숨김 + 서버 403 처리).

**DoD**: 로그인→조직 선택→케이스 CRUD가 브라우저에서 동작, `npm run build` 그린.
**커밋 예**: `feat: 프론트 셸과 인증 플로우`, `feat: 조직 전환과 역할 기반 UI`, `feat: 스위트/케이스 관리 화면`

---

## C7 — 실행 실시간 화면 + 버그 + 대시보드

1. `useRunSocket` 훅: 연결·룸 조인·이벤트 → `setQueryData` 패치, 재연결 시 룸 재조인 + REST 재조회.
2. 실행 보드: 케이스 리스트 + 단축키 기록(P/F/B/S), 진행률 바, **접속자(Participant) 아바타**, "OOO님이 방금 기록" 토스트.
3. FAIL → 버그 생성 모달(초안 프리필), 버그 목록/상태 변경.
4. 대시보드: Recharts 통과율 추이(라인) + 결과 분포(바/도넛) + 열린 버그 카드, 감사로그 화면(ADMIN, 필터 + 무한스크롤).

**DoD**: 브라우저 2개로 동시 기록 → 양쪽 실시간 반영 확인(데모 GIF 촬영 대상).
**커밋 예**: `feat: 실행 실시간 보드`, `feat: 버그 리포트 화면`, `feat: 대시보드 차트와 감사로그 뷰`

---

## C8 — 시드 · 문서 · 배포

1. `scripts/seed-demo.ts`(idempotent): SPEC F8 그대로 — `admin`/`admin`, 조직 2개(ADMIN·VIEWER), 스위트 3·케이스 10·완료 실행 2·진행 중 1·버그 3·감사로그.
2. README: 템플릿(`.claude/templates/README.md.tmpl`) 기반 + mermaid 아키텍처 + 데모 GIF + 라이브 URL + **"왜 안 만들었나"(SPEC 4장) 요약** + 향후 과제(RLS, Redis adapter).
3. CI: 백엔드(lint·test with Testcontainers·build) + 프론트(build). GitHub Actions 그린 배지.
4. 배포: Neon DB 생성 → Render Blueprint(`render.yaml`, `migrate deploy` CMD, `/health`) → Vercel(프론트, 환경변수) → CORS/WS origin 확정 → 시드 1회 실행 → **사람 승인 게이트** 후 최종 공개.

**DoD**: 라이브 URL에서 데모 로그인 1클릭 → 채워진 대시보드 → 실행 화면 2탭 실시간 동작.
**커밋 예**: `chore: 데모 시드 스크립트`, `docs: README와 아키텍처 다이어그램`, `ci: GitHub Actions 파이프라인`, `chore: Render/Vercel 배포 설정`

---

## Testcontainers 통합테스트 — 검증 시나리오 목록

`test/` 아래에서 실제 Postgres 컨테이너 1개를 띄우고(스위트 전체 공유), 테스트마다 트랜잭션 롤백 또는 truncate로 격리. 픽스처: 조직 A(ADMIN·QA_LEAD·TESTER·VIEWER 각 1명) / 조직 B(ADMIN 1명, 별도 자산 세트).

### 그룹 1 — 테넌트 격리 (프로젝트 1순위 증거)

| ID  | 시나리오                                                                                            | 기대                                                 |
| --- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| T-1 | 조직 A 사용자가 조직 B의 `orgId`로 모든 리소스 목록 GET (suites/cases/runs/bugs/audit-logs/members) | 전부 **404**                                         |
| T-2 | 조직 A 사용자가 조직 A 경로 + **조직 B 리소스 id**로 상세 GET/PATCH/DELETE                          | 전부 404, B의 데이터 변경 없음                       |
| T-3 | 조직 A 목록 응답에 조직 B 레코드가 단 1건도 포함되지 않음(각 리소스 유형 전수)                      | 교집합 0                                             |
| T-4 | 조직 A 컨텍스트에서 케이스 생성 시 body에 `organizationId: B`를 강제로 넣음                         | 무시 또는 예외, 저장된 행은 A 소속                   |
| T-5 | 조직 A 스위트에 조직 B 케이스를 붙이는 직접 쿼리(서비스 우회)                                       | **DB 복합 FK가 거부**                                |
| T-6 | ALS 컨텍스트 없이 테넌트 모델 쿼리 실행                                                             | `TENANT_CONTEXT_MISSING` 예외(조용한 전체 조회 아님) |
| T-7 | 조직 B 멤버가 조직 A 실행 룸에 `run:join` 소켓 요청                                                 | 조인 거부, 이후 이벤트 미수신                        |

### 그룹 2 — RBAC 권한 경계

| ID   | 시나리오                                                                 | 기대                                |
| ---- | ------------------------------------------------------------------------ | ----------------------------------- |
| T-8  | Role × 주요 엔드포인트 매트릭스(VIEWER/TESTER/QA_LEAD/ADMIN × 쓰기 20종) | 표대로 200/403                      |
| T-9  | 미배정 TESTER의 결과 기록                                                | 403 `RUN_NOT_ASSIGNED`              |
| T-10 | 배정된 TESTER의 결과 기록 / QA_LEAD의 미배정 기록                        | 둘 다 200                           |
| T-11 | ADMIN이 자신을 포함한 마지막 ADMIN을 강등·제거                           | 409 `MEMBER_LAST_ADMIN`             |
| T-12 | 역할을 TESTER→VIEWER로 강등한 **직후** 기존 access token으로 쓰기 시도   | **즉시 403**(토큰에 role 없음 증명) |
| T-13 | VIEWER의 감사로그 조회                                                   | 403                                 |

### 그룹 3 — 실행 · 실시간 · 동시성

| ID   | 시나리오                                           | 기대                                                        |
| ---- | -------------------------------------------------- | ----------------------------------------------------------- |
| T-14 | 실행 생성 후 원본 케이스 제목·스텝 수정            | RunCase 스냅샷 불변                                         |
| T-15 | 같은 RunCase에 두 사용자가 연속 기록(FAIL→PASS)    | 최종 PASS, 카운터 합 = total, 이벤트 2회 발행               |
| T-16 | 결과 기록 트랜잭션이 실패(예: 카운터 갱신 중 예외) | DB 변경 없음 **+ WS 이벤트 미발행**                         |
| T-17 | 클라이언트 2개가 같은 run 룸, 한쪽 REST 기록       | 다른 쪽이 `run:case.recorded` + `run:progress.updated` 수신 |
| T-18 | 소켓 재연결 후 룸 재조인                           | 프레즌스 갱신 이벤트 수신, 중복 조인 없음                   |
| T-19 | 케이스 0건으로 실행 생성 / COMPLETED 실행에 기록   | 400 / 409                                                   |

### 그룹 4 — 감사로그 · 인증

| ID   | 시나리오                                                             | 기대                                                          |
| ---- | -------------------------------------------------------------------- | ------------------------------------------------------------- |
| T-20 | 케이스 수정                                                          | `CASE_UPDATED` 1건, metadata에 변경 필드만 before/after       |
| T-21 | 도메인 트랜잭션 롤백                                                 | 감사로그도 남지 않음(원자성)                                  |
| T-22 | 멤버 제거 후 감사로그 조회                                           | `actorEmail` 스냅샷으로 행위자 식별 가능                      |
| T-23 | 감사로그 조회 필터(action/actor/target/기간) + 커서 페이지네이션     | 정확한 결과, 중복·누락 없음                                   |
| T-24 | refresh 회전 후 구 토큰 재사용                                       | 401 + 같은 familyId 전체 폐기 + `AUTH_REFRESH_REUSE_DETECTED` |
| T-25 | `admin` 로그인(형식 우회) / `not-an-email` 로그인 / `admin` 회원가입 | 200 / 400 / 400                                               |
| T-26 | 잘못된 비밀번호로 `admin` 로그인                                     | 401 (비번 우회 없음 증명)                                     |

---

## 검수 체크리스트 (청크 완료마다 메인 세션에서 확인)

- [ ] 새 쿼리에 손으로 쓴 조직 필터가 아니라 확장이 동작하는가(주석으로 근거 남았는가)
- [ ] 공개 메서드에 "왜" 중심 JSDoc, 트랜잭션·보안·비즈니스 규칙에만 인라인 주석, 자명한 주석 없음
- [ ] Swagger에 새 엔드포인트와 요구 Role이 노출됐는가
- [ ] `.env`·시크릿 커밋 없음, 새 의존성 추가 시 정당화 가능한가(ponytail)
- [ ] 커밋이 Conventional Commits + 의미 단위로 쪼개졌는가
