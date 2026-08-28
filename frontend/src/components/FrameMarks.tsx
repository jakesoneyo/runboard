/** variant-c-bold의 블루프린트 정합 마크(네 모서리 십자선) — 순수 장식, 상호작용 없음. */
const POSITIONS = [
  "top-3.5 left-3.5",
  "top-3.5 right-3.5",
  "bottom-3.5 left-3.5",
  "bottom-3.5 right-3.5",
];

export function FrameMarks() {
  return (
    <>
      {POSITIONS.map((pos) => (
        <div
          key={pos}
          aria-hidden
          className={`pointer-events-none fixed z-5 h-[22px] w-[22px] opacity-55 ${pos}`}
        >
          <div className="absolute top-1/2 h-[1.5px] w-full -translate-y-1/2 bg-ink" />
          <div className="absolute left-1/2 h-full w-[1.5px] -translate-x-1/2 bg-ink" />
        </div>
      ))}
    </>
  );
}
