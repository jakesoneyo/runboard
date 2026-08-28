# API — Runboard

Base URL: `https://<render-host>` ｜ 프리픽스 `/api` ｜ Swagger: `/api/docs`
용어는 [UBIQUITOUS_LANGUAGE.md](./UBIQUITOUS_LANGUAGE.md), 인가 규칙 배경은 [ARCHITECTURE.md](./ARCHITECTURE.md) 3~5장.

## 1. 공통 규약

- **인증**: `Authorization: Bearer <accessToken>` (access 15분). 표에 `Public`이 아닌 모든 엔드포인트에 필수.
- **조직 스코프**: 테넌트 리소스는 전부 `/api/orgs/:orgId/...`. 요청자가 그 조직의 **Member**가 아니면 **404**(존재 은닉). 조직 안에서 **Role**이 부족하면 **403**.
- **권한 표기**: `MEMBER` = 조직의 아무 역할이나, `VIEWER+ / TESTER+ / QA_LEAD+ / ADMIN` = 해당 등급 이상(ADMIN > QA_LEAD > TESTER > VIEWER).
- **페이지네이션**: `?cursor=<id>&take=20`(기본 20, 최대 100) → `{ items: [...], nextCursor: string | null }`.
- **검증**: 모든 body/query를 Zod로 파싱. 실패 시 400 + `details`에 필드별 메시지.
- **에러 포맷**

```json
{
  "statusCode": 403,
  "code": "RUN_NOT_ASSIGNED",
  "message": "이 실행에 배정되지 않았습니다.",
  "details": null
}
```

| code                       | status | 발생 상황                                                                                                                |
| -------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------ |
| `VALIDATION_FAILED`        | 400    | Zod 검증 실패                                                                                                            |
| `AUTH_INVALID_CREDENTIALS` | 401    | 로그인 실패(사용자 존재 여부 노출 안 함)                                                                                 |
| `AUTH_TOKEN_EXPIRED`       | 401    | access 만료 → 클라이언트가 refresh 시도                                                                                  |
| `AUTH_REFRESH_REUSE`       | 401    | 폐기된 refresh 재사용 → 계열 전체 폐기                                                                                   |
| `AUTH_REFRESH_INVALID`     | 401    | refresh 토큰이 없거나 만료(재사용 탐지와는 별개)                                                                         |
| `AUTH_EMAIL_TAKEN`         | 409    | 회원가입 시 이미 가입된 이메일                                                                                           |
| `ORG_FORBIDDEN`            | 403    | 조직 내 Role 부족                                                                                                        |
| `RUN_NOT_ASSIGNED`         | 403    | TESTER가 미배정 실행을 기록 시도                                                                                         |
| `NOT_FOUND`                | 404    | 리소스 없음 **또는 조직 경계 밖**                                                                                        |
| `MEMBER_LAST_ADMIN`        | 409    | 마지막 ADMIN 강등/제거 시도                                                                                              |
| `RUN_NO_CASES`             | 400    | suiteIds/caseIds가 실제로 케이스 0건으로 귀결(C4) — Zod 스키마 통과 후 DB 조회로만 알 수 있어 `VALIDATION_FAILED`와 분리 |
| `RUN_NOT_IN_PROGRESS`      | 409    | 완료/중단된 실행에 결과 기록 시도                                                                                        |
| `RUN_INVALID_TRANSITION`   | 409    | 실행 상태 전이 규칙 위반(C4) — 종료 상태 재변경, 순서를 건너뛴 전이                                                      |
| `TENANT_CONTEXT_MISSING`   | 500    | 조직 컨텍스트 없이 테넌트 쿼리 실행(버그)                                                                                |

---

## 2. 인증 (`/api/auth`)

| Method | Path             | 권한   | 요청                                        | 응답                                                                                         |
| ------ | ---------------- | ------ | ------------------------------------------- | -------------------------------------------------------------------------------------------- |
| POST   | `/auth/register` | Public | `{ email(이메일형식), password(8+), name }` | 201 `{ user, accessToken, refreshToken }`                                                    |
| POST   | `/auth/login`    | Public | `{ email, password }`                       | 200 `{ user, accessToken, refreshToken, memberships: [{organizationId, name, slug, role}] }` |
| POST   | `/auth/refresh`  | Public | `{ refreshToken }`                          | 200 `{ accessToken, refreshToken }` (기존 토큰 폐기·회전)                                    |
| POST   | `/auth/logout`   | Bearer | `{ refreshToken }`                          | 204                                                                                          |
| GET    | `/auth/me`       | Bearer | –                                           | 200 `{ user, memberships[] }`                                                                |

- 로그인 스키마만 `email === 'admin'` 리터럴 하나에 대해 이메일 형식 검증을 우회한다. `register`는 항상 실이메일.
- 비밀번호는 항상 bcrypt 비교(우회 없음). 인증 없이 호출 가능한 로그인 대체 경로는 존재하지 않는다.
- 로그인 성공/실패는 감사로그(`AUTH_LOGIN_SUCCEEDED` / `AUTH_LOGIN_FAILED`)로 남는다.

## 3. 조직 · 멤버십 · 초대

| Method | Path                                     | 권한   | 요청 / 응답 요약                                                                                      |
| ------ | ---------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------- |
| GET    | `/orgs`                                  | Bearer | 내 **Membership** 목록 `[{ id, name, slug, role, memberCount }]`                                      |
| POST   | `/orgs`                                  | Bearer | `{ name, slug? }` → 201, 생성자는 **ADMIN**. `ORG_CREATED` 감사로그                                   |
| GET    | `/orgs/:orgId`                           | MEMBER | `{ id, name, slug, createdAt, myRole }`                                                               |
| PATCH  | `/orgs/:orgId`                           | ADMIN  | `{ name? }` → 200                                                                                     |
| GET    | `/orgs/:orgId/members`                   | MEMBER | `[{ userId, name, email, role, joinedAt }]`                                                           |
| PATCH  | `/orgs/:orgId/members/:userId`           | ADMIN  | `{ role }` → 200. 마지막 ADMIN 강등 시 409. `MEMBER_ROLE_CHANGED` 감사로그                            |
| DELETE | `/orgs/:orgId/members/:userId`           | ADMIN  | 204. 마지막 ADMIN 제거 시 409. `MEMBER_REMOVED` 감사로그                                              |
| POST   | `/orgs/:orgId/invitations`               | ADMIN  | `{ email, role }` → 201 `{ id, email, role, expiresAt, inviteUrl }` (메일 발송 없음 — 링크 복사)      |
| GET    | `/orgs/:orgId/invitations`               | ADMIN  | `[{ id, email, role, status, expiresAt }]`                                                            |
| DELETE | `/orgs/:orgId/invitations/:invitationId` | ADMIN  | 204 (status → REVOKED)                                                                                |
| POST   | `/invitations/accept`                    | Bearer | `{ token }` → 200 `{ organizationId, role }`. 이메일 불일치/만료 시 404·409. `MEMBER_JOINED` 감사로그 |

## 4. 스위트 · 케이스

| Method | Path                           | 권한     | 요청 / 응답 요약                                                                      |
| ------ | ------------------------------ | -------- | ------------------------------------------------------------------------------------- |
| GET    | `/orgs/:orgId/suites`          | MEMBER   | `?tree=true` → 중첩 트리 `[{ id, name, position, caseCount, children[] }]` (쿼리 1회) |
| POST   | `/orgs/:orgId/suites`          | QA_LEAD+ | `{ name, description?, parentId?, position? }` → 201. 4단계 이상이면 400              |
| PATCH  | `/orgs/:orgId/suites/:suiteId` | QA_LEAD+ | `{ name?, description?, parentId?, position? }` → 200 (순환 참조 400)                 |
| DELETE | `/orgs/:orgId/suites/:suiteId` | QA_LEAD+ | 204 (하위 스위트·케이스 cascade, **RunCase 스냅샷은 보존**)                           |
| GET    | `/orgs/:orgId/cases`           | MEMBER   | `?suiteId=&priority=&q=&cursor=&take=` → 목록(steps 제외한 요약 필드)                 |
| POST   | `/orgs/:orgId/cases`           | QA_LEAD+ | `{ suiteId, title, preconditions?, steps[], expectedResult, priority }` → 201         |
| GET    | `/orgs/:orgId/cases/:caseId`   | MEMBER   | 상세(steps 포함)                                                                      |
| PATCH  | `/orgs/:orgId/cases/:caseId`   | QA_LEAD+ | 부분 수정 → 200. `CASE_UPDATED` 감사로그에 변경 필드 before/after 저장                |
| DELETE | `/orgs/:orgId/cases/:caseId`   | QA_LEAD+ | 204                                                                                   |

`steps` 스키마: `[{ order: int(1~), action: string(1..500), expected?: string(0..500) }]`, 1~50개.

## 5. 실행 (TestRun)

| Method | Path                                                  | 권한                            | 요청 / 응답 요약                                                                                                                                                                             |
| ------ | ----------------------------------------------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/orgs/:orgId/runs`                                   | MEMBER                          | `?status=&assignedToMe=true&cursor=` → `[{ id, name, status, totalCount, passedCount, ..., progress, passRate, assignees[] }]`                                                               |
| POST   | `/orgs/:orgId/runs`                                   | QA_LEAD+                        | `{ name, description?, suiteIds?: string[], caseIds?: string[], assigneeIds?: string[] }` → 201. 선택된 케이스를 **RunCase 스냅샷**으로 복사(트랜잭션 1회, `createMany`). 케이스 0건이면 400 |
| GET    | `/orgs/:orgId/runs/:runId`                            | MEMBER                          | 상세 + 카운터 + 배정자                                                                                                                                                                       |
| GET    | `/orgs/:orgId/runs/:runId/cases`                      | MEMBER                          | `?result=` → `[{ id, position, title, steps, expectedResult, priority, result, comment, recordedBy, recordedAt }]`                                                                           |
| PATCH  | `/orgs/:orgId/runs/:runId/cases/:runCaseId`           | QA_LEAD+ **또는** 배정된 TESTER | `{ result: PASS\|FAIL\|BLOCKED\|SKIPPED\|PENDING, comment? }` → 200 `{ runCase, counters }`. 실행이 IN_PROGRESS가 아니면 409. **WS 브로드캐스트 발생**                                       |
| PATCH  | `/orgs/:orgId/runs/:runId/status`                     | QA_LEAD+                        | `{ status: IN_PROGRESS\|COMPLETED\|ABORTED }` → 200. 전이 규칙 위반 시 409. WS `run:status.changed`                                                                                          |
| PUT    | `/orgs/:orgId/runs/:runId/assignees`                  | QA_LEAD+                        | `{ userIds: string[] }` → 200(전체 치환). 조직 밖 사용자 포함 시 404                                                                                                                         |
| GET    | `/orgs/:orgId/runs/:runId/cases/:runCaseId/bug-draft` | TESTER+                         | 200 `{ title, description, stepsToReproduce[] }` — RunCase 스냅샷 기반 초안(저장 안 함)                                                                                                      |

- `progress = (total - pending) / total`, `passRate = passed / (total - pending)` — 카운터에서 계산(집계 쿼리 없음).
- 상태 전이: `PLANNED → IN_PROGRESS → COMPLETED`, 어디서든 `ABORTED` 가능, 종료 상태에서 되돌리기 불가.

## 6. 버그

| Method | Path                       | 권한     | 요청 / 응답 요약                                                                                                                        |
| ------ | -------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/orgs/:orgId/bugs`        | MEMBER   | `?status=&severity=&testRunId=&cursor=` → 목록                                                                                          |
| POST   | `/orgs/:orgId/bugs`        | TESTER+  | `{ title, description, stepsToReproduce[], severity, testRunCaseId? }` → 201. WS `bug:created`(org 룸)                                  |
| GET    | `/orgs/:orgId/bugs/:bugId` | MEMBER   | 상세 + 연결된 **RunCase** 요약                                                                                                          |
| PATCH  | `/orgs/:orgId/bugs/:bugId` | QA_LEAD+ | `{ title?, description?, severity?, status?, assigneeId? }` → 200. `status=RESOLVED`면 `resolvedAt` 세팅. `BUG_STATUS_CHANGED` 감사로그 |

## 7. 대시보드 · 감사로그 · 헬스

| Method | Path                                     | 권한   | 응답 요약                                                                                                                                                                  |
| ------ | ---------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/orgs/:orgId/dashboard/summary`         | MEMBER | `{ runs: {active, completed}, cases: {total}, resultDistribution: {PASS,FAIL,BLOCKED,SKIPPED,PENDING}, openBugs: {MINOR,MAJOR,CRITICAL}, recentRuns: [...] }` (쿼리 3~4회) |
| GET    | `/orgs/:orgId/dashboard/pass-rate-trend` | MEMBER | `?limit=10` → `[{ runId, name, completedAt, passRate, total }]` (카운터만 읽음)                                                                                            |
| GET    | `/orgs/:orgId/audit-logs`                | ADMIN  | `?action=&actorId=&targetType=&targetId=&from=&to=&cursor=` → `{ items: [{ id, action, actor:{id,email}, targetType, targetId, metadata, ip, createdAt }], nextCursor }`   |
| GET    | `/health`                                | Public | `{ status: "ok", db: "up", uptime }` — Render healthCheck 대상                                                                                                             |

감사로그는 조회 전용이다(생성/수정/삭제 API 없음).

---

## 8. WebSocket

- 엔드포인트: `wss://<host>/realtime` (socket.io, `transports: ['websocket']`)
- 핸드셰이크: `io(url, { auth: { token: <accessToken> } })` → 검증 실패 시 연결 거부(`connect_error`)
- 쓰기는 전부 REST. 소켓은 **구독·브로드캐스트 전용**이다.

### 클라이언트 → 서버

| 이벤트      | 페이로드           | ACK / 동작                                                                                 |
| ----------- | ------------------ | ------------------------------------------------------------------------------------------ |
| `org:join`  | `{ orgId }`        | **Membership** 확인 후 `org:{orgId}` 룸 조인. 실패 시 ack `{ ok:false, code:'NOT_FOUND' }` |
| `org:leave` | `{ orgId }`        | 룸 해제                                                                                    |
| `run:join`  | `{ orgId, runId }` | 조직 멤버십 + 실행 소속 확인 후 `run:{runId}` 조인, ack로 현재 **Participant** 목록 반환   |
| `run:leave` | `{ orgId, runId }` | 룸 해제 후 프레즌스 갱신 브로드캐스트                                                      |

### 서버 → 클라이언트

| 이벤트                  | 룸                            | 페이로드                                                                                          | 발생 시점                      |
| ----------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------ |
| `run:case.recorded`     | `run:{runId}`                 | `{ runCaseId, result, previousResult, comment, recordedBy: {id,name}, recordedAt }`               | 결과 기록 **트랜잭션 커밋 후** |
| `run:progress.updated`  | `run:{runId}`                 | `{ runId, totalCount, passedCount, failedCount, blockedCount, skippedCount, progress, passRate }` | 결과 기록·실행 상태 변경 직후  |
| `run:presence.updated`  | `run:{runId}`                 | `{ runId, participants: [{ userId, name }] }`                                                     | 조인/해제/연결 끊김            |
| `run:status.changed`    | `run:{runId}` + `org:{orgId}` | `{ runId, status, changedBy, at }`                                                                | 실행 시작/종료/중단            |
| `run:assignees.changed` | `run:{runId}`                 | `{ runId, assignees: [{ userId, name }] }`                                                        | 배정자 변경                    |
| `bug:created`           | `org:{orgId}`                 | `{ bugId, title, severity, runId?, reportedBy }`                                                  | 버그 생성                      |
| `error`                 | 개별 소켓                     | `{ code, message }`                                                                               | 인가 실패·잘못된 페이로드      |

### 클라이언트 규칙

- 이벤트 수신 시 TanStack Query 캐시를 `setQueryData`로 패치(전체 재조회 금지).
- `connect`/`reconnect` 시 룸 재조인 + 해당 실행 REST 재조회로 **유실 이벤트 복구**.
- access 토큰 갱신 후에는 `socket.auth.token`을 교체하고 재연결한다.
