import type { HTMLAttributes } from "react";

/**
 * variant-c-bold .panel — 각진 보더 카드. 화면 전체의 기본 컨테이너 단위.
 * 배경색(bg-*)은 일부러 기본값에 넣지 않는다 — 호출부가 bg-ink 같은 다른 배경을 섞어 넘기면
 * Tailwind는 클래스 문자열 순서가 아니라 "빌드된 CSS에 먼저 정의된 유틸리티"를 기준으로 승자를
 * 정하기 때문에, 기본 bg-paper-raised와 충돌해 배경/글자색이 뒤섞이는 사고(흰 배경에 흰 글자)가
 * 났었다. 그래서 배경은 항상 호출부가 명시하게 하고, 여기서는 테두리·여백만 강제한다.
 */
export function Panel({
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`border-[1.5px] border-ink p-6 ${className}`} {...props} />
  );
}

/** variant-c-bold .panel-label — 섹션 상단의 대문자 라벨 + 하단 굵은 밑줄. */
export function PanelLabel({ children }: { children: string }) {
  return (
    <div className="mb-4 border-b-2 border-ink pb-2.5 text-[11px] font-extrabold tracking-[0.06em] text-ink uppercase">
      {children}
    </div>
  );
}
