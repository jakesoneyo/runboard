# DESIGN — 시안 선택 결과

## 최종 선택: 시안 C "Audit Terminal"

**다이얼**: VARIANCE 높음(8) · MOTION 중간(5) · DENSITY 낮음~~중간(3~~4)

## 왜 이 시안인가

`runboard`는 유형 태그가 "실시간 + 인증/보안 고도화" 하이브리드다. 세 시안 중 C만 **보안/감사(Audit) 성격을 톤 자체로 표현**했다 — 블루프린트 각선 배경, 전 요소 각진 모서리(radius:0), monospace 전용 타이포, 감사로그를 표가 아니라 터미널 로그 라인으로 배치. 이게 워크스페이스 다양성 규칙상 이번에 채워야 하는 "인증/보안 고도화" 유형의 시각적 증거로 가장 직접적이다.

- A(Calm)·B(Live Pulse)는 일반적인 SaaS 대시보드 룩에 가까워 다른 포폴 프로젝트(예: `pingboard`, `study-fine`)와 톤이 겹칠 위험이 있었음.
- C는 VARIANCE를 높게 잡아도(과감한 레이아웃) 실무 툴로서 가독성을 잃지 않도록 DENSITY를 낮춰 균형을 맞춤(정보량은 스트립/패널 단위로 묶어서 제시).

## 실제 구현(Tailwind v4 + React) 시 반영 지침

목업은 순수 HTML/inline-CSS였으므로, 프론트 구현(PLAN.md C6~C7)에서 아래 원칙으로 옮긴다:

- **컬러**: `--ink:#0b0e13` / `--paper:#eef1f6` / `--accent:#2748ff` 3색 축 + 결과 세맨틱 컬러(pass/fail/blocked/skip)를 Tailwind `theme` 확장 토큰으로 등록. 다른 색 추가 금지(컬러락).
- **형태**: 전 요소 `rounded-none` 고정(모서리 각짐이 "감사/블루프린트" 컨셉의 핵심이라 임의로 둥글리지 않음).
- **타이포**: 전 화면 `font-mono`(시스템 모노스택), 헤드라인은 `clamp()` 기반 대형 사이즈 유지.
- **감사로그 컴포넌트**: 표가 아니라 세로 룰러선 + 로그 라인(타임스탬프·행위자·액션 동사 배지·대상) 구조를 그대로 재사용 — `AuditLogFeed` 컴포넌트로 분리해 C7에서 재사용.
- **모션**: LIVE 인디케이터 pulse, 화면 전환 fade-up 정도로 절제(목업 그대로) — `prefers-reduced-motion` 대응 필수.
- **반응형**: 목업의 브레이크포인트(약 860px/900px/820px) 그대로 Tailwind `md`/`lg` 브레이크포인트에 매핑.

## 참고 원본

정적 목업 3종은 `design-mockups/`에 보관(구현 완료 후에도 참고용으로 남김):

- `variant-a-calm.html` (미선택)
- `variant-b-dynamic.html` (미선택)
- `variant-c-bold.html` (**선택** — 이 파일의 마크업/클래스 구조를 프론트 구현의 1차 레퍼런스로 사용)
