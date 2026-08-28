import type { ReactNode } from "react";

export type BadgeTone =
  "pass" | "fail" | "blocked" | "skip" | "accent" | "role" | "role-inverted";

const TONE_CLASSES: Record<BadgeTone, string> = {
  pass: "text-pass bg-pass-tint border-pass",
  fail: "text-fail bg-fail-tint border-fail",
  blocked: "text-blocked bg-blocked-tint border-blocked",
  skip: "text-skip bg-skip-tint border-skip",
  accent: "text-accent-ink bg-accent-tint border-accent-ink",
  role: "text-ink bg-white border-ink",
  // 어두운 배경(is-you 카드) 위에 올릴 때 쓴다 — "role"의 색상 클래스를 className으로 덮어쓰려
  // 하면 Tailwind가 클래스 문자열 순서가 아니라 빌드된 CSS 등장 순서로 승자를 정해서 흰 배경에
  // 흰 글자가 되는 사고가 났었다(components/ui/Panel.tsx와 같은 원인). 그래서 색상 톤은 항상
  // 이렇게 완전히 별도인 톤으로만 바꾸고, className은 색상 유틸리티를 절대 넘기지 않는다.
  "role-inverted": "text-white bg-transparent border-white",
};

/** className은 마진 등 레이아웃 조정용으로만 쓴다 — 색상 유틸리티는 반드시 tone으로만 바꾼다. */
export function Badge({
  tone = "role",
  children,
  className = "",
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-none border-[1.5px] px-2 py-0.5 text-[10.5px] font-extrabold tracking-[0.03em] ${TONE_CLASSES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
