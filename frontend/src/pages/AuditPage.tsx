import { useEffect, useRef, useState } from "react";
import { useAuditLogs } from "../features/audit/hooks";
import { useMembers } from "../features/members/hooks";
import { AUDIT_ACTIONS } from "../features/audit/constants";
import { PanelLabel } from "../components/ui/Panel";
import { Select, TextInput } from "../components/ui/Field";
import { AuditLogFeed } from "../components/audit/AuditLogFeed";

/**
 * API.md 7장 — 감사로그 조회(ADMIN 전용, 라우트 자체는 RequireOrgRole이 가드). 필터가 바뀌면
 * 쿼리 키가 바뀌어 useInfiniteQuery가 첫 페이지부터 자동으로 다시 시작한다.
 */
export function AuditPage() {
  const { data: members = [] } = useMembers();
  const [action, setAction] = useState("");
  const [actorId, setActorId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useAuditLogs({
      action: action || undefined,
      actorId: actorId || undefined,
      from: from ? new Date(from).toISOString() : undefined,
      to: to ? new Date(to).toISOString() : undefined,
      take: 20,
    });

  // 무한스크롤: 목록 끝의 sentinel이 뷰포트에 들어오면 다음 커서 페이지를 이어붙인다.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
        void fetchNextPage();
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const items = data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div>
      <PanelLabel>AUDIT LOG</PanelLabel>

      <div className="mb-6 flex flex-wrap gap-2">
        <Select
          value={action}
          onChange={(e) => setAction(e.target.value)}
          className="max-w-[220px]"
        >
          <option value="">전체 액션</option>
          {AUDIT_ACTIONS.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </Select>
        <Select
          value={actorId}
          onChange={(e) => setActorId(e.target.value)}
          className="max-w-[200px]"
        >
          <option value="">전체 행위자</option>
          {members.map((m) => (
            <option key={m.userId} value={m.userId}>
              {m.name}
            </option>
          ))}
        </Select>
        <TextInput
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="max-w-[160px]"
          aria-label="시작일"
        />
        <TextInput
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="max-w-[160px]"
          aria-label="종료일"
        />
      </div>

      {isLoading ? (
        <p className="text-[12.5px] text-ink/60">불러오는 중...</p>
      ) : (
        <>
          <AuditLogFeed items={items} />
          <div ref={sentinelRef} className="h-4" />
          {isFetchingNextPage && (
            <p className="py-3 text-center text-[11px] text-ink/50">
              불러오는 중...
            </p>
          )}
        </>
      )}
    </div>
  );
}
