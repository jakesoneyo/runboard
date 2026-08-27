# Ubiquitous Language — Runboard

기획 회의 대화에서 추출한 도메인 표준 용어. **SPEC / ARCHITECTURE / DATA-MODEL / API / 코드(모델명·DTO·이벤트명) 전부 이 표를 그대로 따른다.**
한국어 UI 문구도 "표기(UI)" 열을 고정으로 쓴다. 표에 없는 새 개념이 생기면 코드보다 먼저 이 파일을 고친다.

---

## 1. 테넌시 · 사람

| Term                     | 표기(UI)  | Definition                                                              | Aliases to avoid             |
| ------------------------ | --------- | ----------------------------------------------------------------------- | ---------------------------- |
| **Organization**         | 조직      | 모든 데이터의 격리 경계가 되는 테넌트 단위                              | 팀, 워크스페이스, 회사, 계정 |
| **User**                 | 사용자    | 이메일·비밀번호로 로그인하는 인증 아이덴티티(조직에 속하지 않아도 존재) | 계정, 멤버, 로그인           |
| **Membership**           | 멤버십    | 한 **User**가 한 **Organization** 안에서 갖는 소속과 **Role**의 결합    | 팀원, 유저권한, 조직유저     |
| **Member**               | 멤버      | **Membership**을 가진 **User**를 조직 관점에서 부르는 말                | 참여자, 팀원                 |
| **Role**                 | 역할      | 조직 안에서의 권한 등급(ADMIN / QA_LEAD / TESTER / VIEWER)              | 권한, 등급, 레벨             |
| **Permission**           | 권한      | "케이스 수정 가능" 같은 개별 행위 허용 여부. **Role**이 이를 결정한다   | 역할(혼용 금지)              |
| **Invitation**           | 초대      | 아직 **Membership**이 되지 않은, 특정 이메일 대상 조직 가입 제안        | 초대장, 가입요청, 대기멤버   |
| **Organization Context** | 현재 조직 | 한 요청이 어느 **Organization**을 대상으로 하는지 결정된 상태           | 테넌트세션, 현재팀           |

## 2. 테스트 자산 (재사용되는 정의)

| Term                | 표기(UI) | Definition                                                               | Aliases to avoid               |
| ------------------- | -------- | ------------------------------------------------------------------------ | ------------------------------ |
| **TestSuite**       | 스위트   | 같은 조직 안에서 **TestCase**를 담는 트리 구조의 묶음                    | 폴더, 카테고리, 그룹, 프로젝트 |
| **TestCase**        | 케이스   | "이렇게 하면 이렇게 되어야 한다"를 적어둔 재사용 가능한 테스트 절차 정의 | 테스트, 시나리오, 티켓, TC     |
| **Step**            | 스텝     | **TestCase** 안의 순서 있는 단일 행동 항목                               | 절차, 단계, 액션               |
| **Expected Result** | 예상결과 | **TestCase**가 통과로 간주되기 위해 관찰돼야 하는 상태                   | 기대값, 정답                   |
| **Priority**        | 우선순위 | **TestCase**의 중요도(LOW~CRITICAL). 무엇을 먼저 도는지 결정             | 심각도(Severity와 혼용 금지)   |

## 3. 실행 (특정 시점의 수행 기록)

| Term              | 표기(UI)    | Definition                                                                   | Aliases to avoid               |
| ----------------- | ----------- | ---------------------------------------------------------------------------- | ------------------------------ |
| **TestRun**       | 실행        | 선택된 **TestCase** 묶음을 한 번 수행하는 세션                               | 실행세션, 사이클, 회차, 라운드 |
| **RunCase**       | 실행 케이스 | **TestRun** 안에 복사된 **TestCase** 스냅샷 1건과 그 결과 슬롯               | 실행결과, 케이스결과, 실행항목 |
| **Result**        | 결과        | **RunCase**의 상태값: PENDING / PASS / FAIL / BLOCKED / SKIPPED              | 판정, 상태, 스테이터스         |
| **Record (동사)** | 기록하다    | **RunCase**에 **Result**를 남기는 행위. 기록 즉시 실시간 브로드캐스트가 발생 | 제출, 저장, 체크               |
| **Assignee**      | 배정자      | 그 **TestRun**을 수행하도록 지정된 **Member**(TESTER의 수행 권한 근거)       | 담당자, 참여자                 |
| **Participant**   | 접속자      | 지금 그 **TestRun** 화면에 실시간 연결되어 있는 **Member**(배정 여부와 무관) | 참가자, 배정자(혼용 금지)      |
| **Progress**      | 진행률      | 전체 **RunCase** 중 PENDING이 아닌 것의 비율                                 | 완료율, 소화율                 |
| **Pass Rate**     | 통과율      | 기록된 **RunCase** 중 PASS의 비율                                            | 성공률, 합격률                 |

## 4. 결함

| Term          | 표기(UI) | Definition                                                         | Aliases to avoid               |
| ------------- | -------- | ------------------------------------------------------------------ | ------------------------------ |
| **BugReport** | 버그     | FAIL로 기록된 **RunCase**에서 파생되는, 수정이 필요한 결함 기록    | 이슈, 결함티켓, 장애           |
| **Severity**  | 심각도   | **BugReport**의 영향 크기(MINOR / MAJOR / CRITICAL)                | 우선순위(Priority와 혼용 금지) |
| **BugStatus** | 처리상태 | **BugReport**의 진행 상태(OPEN / IN_PROGRESS / RESOLVED / WONTFIX) | 진행도, 단계                   |

## 5. 보안 · 감사

| Term              | 표기(UI) | Definition                                                                 | Aliases to avoid         |
| ----------------- | -------- | -------------------------------------------------------------------------- | ------------------------ |
| **AuditLog**      | 감사로그 | 조직 안에서 일어난 되짚어야 할 행위 1건의 불변 기록                        | 히스토리, 활동로그, 이력 |
| **Actor**         | 행위자   | **AuditLog**를 발생시킨 **User**                                           | 작성자, 유저             |
| **Action**        | 액션     | 감사 대상 행위의 종류(예: `CASE_UPDATED`, `MEMBER_ROLE_CHANGED`)           | 이벤트, 타입             |
| **Target**        | 대상     | 그 **Action**이 가해진 엔티티(타입 + id)                                   | 리소스, 객체             |
| **Access Token**  | -        | 15분짜리 단기 JWT. **Organization** 정보는 담지 않는다                     | 토큰(단독 사용 금지)     |
| **Refresh Token** | -        | 회전(rotation)되는 장기 자격증명. 재사용 탐지 시 같은 계열 전체가 폐기된다 | 리프레시, 세션토큰       |

---

## Relationships

- 한 **User**는 0..N개의 **Membership**을 갖고, 각 **Membership**은 정확히 하나의 **Organization**과 하나의 **Role**을 갖는다 → 같은 사람이 A조직 QA_LEAD, B조직 VIEWER일 수 있다.
- 모든 **TestSuite / TestCase / TestRun / RunCase / BugReport / AuditLog**는 정확히 하나의 **Organization**에 속한다. 조직을 넘나드는 참조는 존재할 수 없다.
- **TestSuite**는 0..1개의 부모 **TestSuite**를 갖는다(트리, 최대 3단계).
- **TestCase**는 정확히 하나의 **TestSuite**에 속한다.
- **TestRun**은 생성 시점에 선택된 **TestCase**들을 복사해 1..N개의 **RunCase**를 만든다. 이후 원본 **TestCase**가 수정돼도 **RunCase** 스냅샷은 변하지 않는다.
- **RunCase**는 최대 1개의 **Result**를 현재 값으로 갖고, 마지막으로 **Record**한 **Member**를 기억한다.
- **BugReport**는 0..1개의 **RunCase**에서 파생된다(직접 생성도 가능).
- **TestRun**은 0..N명의 **Assignee**를 갖는다. **Participant**는 DB에 저장하지 않는 실시간 개념이다.

---

## Example dialogue

> **Dev:** "실행 화면에서 두 사람이 같은 **RunCase**를 동시에 **Record**하면 누가 이깁니까?"
>
> **QA 리드:** "나중에 누른 쪽. 대신 **Participant** 모두의 화면에 '누가 방금 무엇을 FAIL로 바꿨다'가 보이면 돼요. 서로 보면서 도니까."
>
> **Dev:** "그럼 그 **TestRun**에 **Assignee**로 안 걸린 TESTER가 들어와서 **Record**할 수도 있나요?"
>
> **QA 리드:** "아뇨. **Assignee**가 아닌 TESTER는 볼 수만 있어야 해요. QA_LEAD는 배정 안 돼 있어도 기록 가능하고요."
>
> **Dev:** "**TestCase**의 스텝을 실행 도중에 QA_LEAD가 고치면, 이미 돌고 있는 **RunCase**도 같이 바뀌어야 하나요?"
>
> **QA 리드:** "절대 안 됩니다. 실행은 그때 그 버전을 돈 기록이에요. 바뀐 건 다음 **TestRun**부터."
>
> **Dev:** "FAIL이면 **BugReport**가 자동 생성되나요?"
>
> **QA 리드:** "자동은 아니고, FAIL이면 '버그 만들기' 버튼이 뜨고 제목·재현스텝이 **RunCase** 스냅샷에서 미리 채워지면 돼요. 안 만들고 넘어가는 FAIL도 많거든요."

---

## Flagged ambiguities (회의에서 나온 모호함 → 표준 결정)

1. **"실행"이 두 가지로 쓰였다** — 세션 전체를 뜻할 때와 케이스 하나를 수행하는 행위를 뜻할 때. → 세션은 **TestRun**(UI "실행"), 세션 안의 케이스 1건은 **RunCase**(UI "실행 케이스"), 결과 남기는 행위는 **Record**(UI "기록")로 고정.
2. **"우선순위"와 "심각도" 혼용** — 케이스에 붙는 건 **Priority**, 버그에 붙는 건 **Severity**. 서로 다른 필드이며 값 집합도 다르다(Priority: LOW/MEDIUM/HIGH/CRITICAL, Severity: MINOR/MAJOR/CRITICAL).
3. **"참여자"가 배정자와 접속자 둘 다로 쓰였다** — 수행하도록 지정된 사람은 **Assignee**(DB에 저장), 지금 소켓으로 붙어 있는 사람은 **Participant**(메모리, 미저장). 권한 판정은 **Assignee**로만 한다.
4. **"권한"이 Role과 Permission 둘 다로 쓰였다** — 사용자에게 부여하는 값은 **Role** 하나뿐이고, 엔드포인트가 요구하는 건 **Permission**. "권한 변경"은 항상 **Role 변경**을 뜻한다(`MEMBER_ROLE_CHANGED`).
5. **"팀"** — 회의에서 조직과 같은 뜻으로 쓰였으나 조직 하위 소그룹으로 오해될 수 있어 금지. 항상 **Organization / 조직**.
6. **"계정"** — **User**(인증 아이덴티티)와 **Organization**(청구/소속 단위) 양쪽으로 읽힌다. 문서·UI 모두에서 금지어. 데모 계정 문구만 예외적으로 "데모 계정"을 관용어로 허용한다.
7. **"상태"** — **RunCase**의 값은 **Result**, **TestRun**의 값은 **RunStatus**, **BugReport**의 값은 **BugStatus**. 접두 없는 "상태" 단독 사용 금지.
