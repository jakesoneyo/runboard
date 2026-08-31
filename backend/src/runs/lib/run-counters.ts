// DATA-MODEL.md 5장 — TestRun의 비정규화 카운터에서 progress/passRate를 계산한다(집계 쿼리 없음).
// RunCaseResult ↔ 카운터 컬럼 매핑도 여기서 관리한다: PENDING은 전용 컬럼이 없다(total - 나머지 합으로 유도).
import type { RunCaseResult } from '@prisma/client';

export type CounterField =
  'passedCount' | 'failedCount' | 'blockedCount' | 'skippedCount';

/** PENDING은 매핑이 없다 — 카운터 증감 로직이 자동으로 "증감 없음"을 뜻하게 된다. */
export const COUNTER_FIELD_BY_RESULT: Partial<
  Record<RunCaseResult, CounterField>
> = {
  PASS: 'passedCount',
  FAIL: 'failedCount',
  BLOCKED: 'blockedCount',
  SKIPPED: 'skippedCount',
};

export interface RunCounterFields {
  totalCount: number;
  passedCount: number;
  failedCount: number;
  blockedCount: number;
  skippedCount: number;
}

export interface RunCounters extends RunCounterFields {
  progress: number;
  passRate: number;
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

/**
 * API.md 5장: progress = (total-pending)/total, passRate = passed/(total-pending).
 * 0~1로 clamp하는 이유: 카운터 갱신 로직에 미래에 다른 버그가 섞여 들어와도(예:
 * applyCounterShift 유사 회귀) 화면에 100%를 넘는 진행률 같은 명백히 잘못된 값이
 * 그대로 노출되지 않도록 하는 마지막 방어선이다 — 근본 수정은 카운터 계산 쪽에서 한다.
 */
export function computeCounters(run: RunCounterFields): RunCounters {
  const recorded =
    run.passedCount + run.failedCount + run.blockedCount + run.skippedCount;
  const progress = run.totalCount === 0 ? 0 : recorded / run.totalCount;
  const passRate = recorded === 0 ? 0 : run.passedCount / recorded;
  return { ...run, progress: clamp01(progress), passRate: clamp01(passRate) };
}
