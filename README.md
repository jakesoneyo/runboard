# runboard

> 멀티테넌트 QA 테스트 케이스·실행 관리 도구 · **유형**: 실시간 + 인증/보안 고도화 · **난이도**: L

🚧 구현 진행 중 (PLAN.md 기준 청크 단위 개발). 상세 스펙은 [SPEC.md](./SPEC.md), 아키텍처는 [ARCHITECTURE.md](./ARCHITECTURE.md), 데이터 모델은 [DATA-MODEL.md](./DATA-MODEL.md), API는 [API.md](./API.md) 참고.

라이브 URL·스크린샷·실행법은 배포(C8) 완료 후 이 섹션에 채워진다.

## 디자인

선택된 시안: [DESIGN.md](./DESIGN.md) — "Audit Terminal" (시안 C). 정적 목업은 `design-mockups/`에 보관.

## 기술 스택 (예정)

- **프론트**: Vite · React · TypeScript · Tailwind v4 · Zustand · TanStack Query · Axios · Recharts · lucide-react · Zod
- **백엔드**: NestJS · Prisma(7.10.0) · Passport-JWT · socket.io · Pino
- **DB**: Neon Postgres
- **배포(예정)**: Vercel(프론트) · Render(백엔드, Docker) · Neon(DB)
