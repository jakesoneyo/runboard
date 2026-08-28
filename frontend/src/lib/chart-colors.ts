// Recharts는 색상을 실제 CSS 값으로 받아야 해서 Tailwind 유틸리티를 쓸 수 없다 — index.css의
// @theme 토큰(DESIGN.md 컬러락)과 값을 동일하게 맞춘 상수로만 차트 색을 정한다(색 추가 금지).
export const CHART_COLORS = {
  ink: "#0b0e13",
  accent: "#2748ff",
  pass: "#127a4a",
  fail: "#b5231f",
  blocked: "#a85a06",
  skip: "#4b5563",
  paperLineStrong: "rgba(11,14,19,0.16)",
} as const;
