import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Link } from "react-router-dom";
import {
  useDashboardSummary,
  usePassRateTrend,
  useRecentRunAssignees,
} from "../features/dashboard/hooks";
import { RUN_STATUS_LABEL, RUN_STATUS_TONE } from "../lib/run-status";
import { CHART_COLORS } from "../lib/chart-colors";
import { PanelLabel } from "../components/ui/Panel";
import { Badge } from "../components/ui/Badge";
import type { RunCaseResult } from "../types/api";

const RESULT_ORDER: RunCaseResult[] = [
  "PASS",
  "FAIL",
  "BLOCKED",
  "SKIPPED",
  "PENDING",
];
const RESULT_COLOR: Record<RunCaseResult, string> = {
  PASS: CHART_COLORS.pass,
  FAIL: CHART_COLORS.fail,
  BLOCKED: CHART_COLORS.blocked,
  SKIPPED: CHART_COLORS.skip,
  PENDING: CHART_COLORS.paperLineStrong,
};

/** API.md 7장 — 대시보드. summary/pass-rate-trend/최근 실행 담당자 3개를 각자의 쿼리 예산대로 따로 부른다. */
export function DashboardPage() {
  const { data: summary, isLoading } = useDashboardSummary();
  const { data: trend = [] } = usePassRateTrend(14);
  const assigneesByRunId = useRecentRunAssignees();

  if (isLoading || !summary) {
    return <p className="text-[12.5px] text-ink/60">불러오는 중...</p>;
  }

  const latestPassRate =
    trend.length > 0 ? trend[trend.length - 1].passRate : 0;
  const distributionData = RESULT_ORDER.map((result) => ({
    result,
    count: summary.resultDistribution[result],
  }));
  const totalOpenBugs =
    summary.openBugs.MINOR + summary.openBugs.MAJOR + summary.openBugs.CRITICAL;

  return (
    <div>
      <PanelLabel>ORGANIZATION DASHBOARD</PanelLabel>

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-[1.7fr_1fr]">
        <div className="border-[1.5px] border-ink bg-paper-raised p-6">
          <div className="mb-4 border-b-2 border-ink pb-2.5 text-[11px] font-extrabold tracking-[0.06em] uppercase">
            PASS RATE TREND · 최근 완료 {trend.length}건
          </div>
          <div className="mb-3.5 flex items-baseline gap-3.5">
            <span className="text-[34px] font-extrabold tracking-[-0.02em]">
              {Math.round(latestPassRate * 100)}%
            </span>
            <span className="text-[12px] font-bold text-ink/50">
              최근 완료 실행 기준
            </span>
          </div>
          {trend.length === 0 ? (
            <p className="text-[12.5px] text-ink/60">
              완료된 실행이 아직 없습니다.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={trend} margin={{ left: -20 }}>
                <CartesianGrid
                  stroke={CHART_COLORS.paperLineStrong}
                  vertical={false}
                />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 9, fontFamily: "var(--font-mono)" }}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 1]}
                  tickFormatter={(v: number) => `${Math.round(v * 100)}`}
                  tick={{ fontSize: 9, fontFamily: "var(--font-mono)" }}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(value) => `${Math.round(Number(value) * 100)}%`}
                  contentStyle={{
                    borderRadius: 0,
                    border: `1.5px solid ${CHART_COLORS.ink}`,
                    fontSize: 12,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="passRate"
                  stroke={CHART_COLORS.accent}
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="flex flex-col gap-6">
          <div className="border-[1.5px] border-ink bg-paper-raised p-6">
            <div className="mb-3.5 text-[11px] font-extrabold tracking-[0.06em] text-ink/60 uppercase">
              OPEN BUGS
            </div>
            <div className="mb-2 text-[44px] leading-none font-extrabold tracking-[-0.03em]">
              {totalOpenBugs}
            </div>
            <div className="flex gap-3 text-[10.5px] font-bold">
              <span className="text-fail">
                CRITICAL {summary.openBugs.CRITICAL}
              </span>
              <span className="text-blocked">
                MAJOR {summary.openBugs.MAJOR}
              </span>
              <span className="text-skip">MINOR {summary.openBugs.MINOR}</span>
            </div>
          </div>

          <div className="border-[1.5px] border-ink bg-paper-raised p-6">
            <div className="mb-2 text-[11px] font-extrabold tracking-[0.06em] text-ink/60 uppercase">
              RECENT RUNS
            </div>
            {summary.recentRuns.length === 0 ? (
              <p className="text-[12.5px] text-ink/60">실행이 없습니다.</p>
            ) : (
              summary.recentRuns.map((run) => (
                <Link
                  key={run.id}
                  to={`/runs/${run.id}`}
                  className="flex items-center justify-between gap-2 border-t border-paper-line py-2.5 first:border-t-0 hover:bg-paper"
                >
                  <div className="min-w-0">
                    <div className="truncate text-[12.5px] font-bold">
                      {run.name}
                    </div>
                    <div className="text-[10px] text-ink/45">
                      {(assigneesByRunId.get(run.id) ?? [])
                        .map((a) => a.name)
                        .join(", ") || "배정자 없음"}
                    </div>
                  </div>
                  <Badge tone={RUN_STATUS_TONE[run.status]}>
                    {RUN_STATUS_LABEL[run.status]}
                  </Badge>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="mb-6 border-[1.5px] border-ink bg-paper-raised p-6">
        <div className="mb-4 border-b-2 border-ink pb-2.5 text-[11px] font-extrabold tracking-[0.06em] uppercase">
          RESULT DISTRIBUTION
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={distributionData} margin={{ left: -20 }}>
            <CartesianGrid
              stroke={CHART_COLORS.paperLineStrong}
              vertical={false}
            />
            <XAxis
              dataKey="result"
              tick={{ fontSize: 10, fontFamily: "var(--font-mono)" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fontFamily: "var(--font-mono)" }}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                borderRadius: 0,
                border: `1.5px solid ${CHART_COLORS.ink}`,
                fontSize: 12,
              }}
            />
            <Bar dataKey="count">
              {distributionData.map((d) => (
                <Cell key={d.result} fill={RESULT_COLOR[d.result]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="flex border-[1.5px] border-ink">
        <StripCell label="ACTIVE RUNS" value={summary.runs.active} />
        <StripCell label="COMPLETED RUNS" value={summary.runs.completed} />
        <StripCell label="TOTAL CASES" value={summary.cases.total} />
        <StripCell label="OPEN BUGS" value={totalOpenBugs} />
      </div>
    </div>
  );
}

function StripCell({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex-1 border-l-[1.5px] border-paper-line-strong px-6 py-5 first:border-l-0">
      <div className="mb-2 text-[10.5px] font-extrabold tracking-[0.05em] text-ink/50">
        {label}
      </div>
      <div className="text-[24px] font-extrabold tracking-[-0.02em]">
        {value}
      </div>
    </div>
  );
}
