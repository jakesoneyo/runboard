import type { RunCounters } from "../../types/api";

/** variant-c-bold .progress-wrap — 비정규화 카운터(progress)를 그대로 너비%로 반영한다. */
export function RunProgressBar({ counters }: { counters: RunCounters }) {
  const recorded =
    counters.passedCount +
    counters.failedCount +
    counters.blockedCount +
    counters.skippedCount;
  const pct = Math.round(counters.progress * 100);

  return (
    <div className="mb-8 mt-4">
      <div className="mb-2 flex justify-between text-[11px] font-bold">
        <span>진행률</span>
        <span>
          {recorded} / {counters.totalCount} 완료 · PASS{" "}
          {Math.round(counters.passRate * 100)}%
        </span>
      </div>
      <div
        className="relative h-4 border-[1.5px] border-ink bg-white"
        style={{
          backgroundImage:
            "repeating-linear-gradient(90deg, var(--color-paper-line-strong) 0, var(--color-paper-line-strong) 1px, transparent 1px, transparent 20px)",
        }}
      >
        <div
          className="h-full bg-accent transition-[width] duration-300 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
