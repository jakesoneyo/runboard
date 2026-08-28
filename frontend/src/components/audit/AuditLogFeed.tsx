import { auditVerbTone } from "../../features/audit/constants";
import type { AuditLogItem } from "../../types/api";

const VERB_CLASS: Record<ReturnType<typeof auditVerbTone>, string> = {
  create: "text-pass bg-pass-tint",
  update: "text-accent-ink bg-accent-tint",
  delete: "text-fail bg-fail-tint",
  login: "text-skip bg-skip-tint",
};

/**
 * DESIGN.md "AUDIT_LOG" 화면의 로그 피드 — 표가 아니라 세로 룰러선 + 타임스탬프/행위자/액션 배지/
 * 대상 한 줄로 구성한다(variant-c-bold .log-feed). C7에서 그대로 재사용하도록 분리했다.
 */
export function AuditLogFeed({ items }: { items: AuditLogItem[] }) {
  if (items.length === 0) {
    return <p className="text-[12.5px] text-ink/60">기록이 없습니다.</p>;
  }

  return (
    <div className="relative pl-7">
      <div className="absolute top-1 bottom-1 left-1.5 w-0.5 bg-ink" />
      {items.map((log) => (
        <div key={log.id} className="relative py-3.5">
          <div className="absolute top-[19px] -left-[27px] h-0.5 w-2.5 bg-ink" />
          <div className="flex flex-wrap items-baseline gap-2.5 text-[12.5px]">
            <span className="flex-none text-ink/45">
              {new Date(log.createdAt).toLocaleString("ko-KR")}
            </span>
            <span className="flex-none font-bold">
              {log.actor?.email ?? "시스템"}
            </span>
            <span
              className={`flex-none px-1.5 py-0.5 text-[10.5px] font-extrabold tracking-[0.03em] ${VERB_CLASS[auditVerbTone(log.action)]}`}
            >
              {log.action}
            </span>
            <span className="text-ink/65">
              {log.targetType}
              {log.targetId ? ` · ${log.targetId.slice(0, 8)}` : ""}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
