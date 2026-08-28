// AppShell 전역에서 한 번만 마운트한다 — 로그인된 동안 소켓 연결을 유지하고 현재 조직의
// org:{orgId} 룸에 머무른다. bug:created/updated처럼 특정 실행 화면이 아니라 조직 전체로
// 브로드캐스트되는 이벤트(API.md 8장)를 받기 위한 최소 전제 조건이다.
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { connectSocket } from "../../lib/socket";
import { useOrgStore } from "../../stores/org-store";
import { useAuthStore } from "../../stores/auth-store";
import { orgScopedKey } from "../../lib/query-keys";

export function useOrgRealtime(): void {
  const accessToken = useAuthStore((s) => s.accessToken);
  const orgId = useOrgStore((s) => s.currentOrgId);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!accessToken || !orgId) return;
    const socket = connectSocket();

    function join() {
      socket.emit("org:join", { orgId });
    }

    // 목록 화면 캐시는 필터 조합별로 나뉘어 있어 항목 하나를 직접 patch하기보다
    // "bugs로 시작하는 쿼리 전부"를 무효화하는 편이 더 정확하고 단순하다(생성/수정 둘 다 재조회 비용이 작다).
    function refreshBugs() {
      void queryClient.invalidateQueries({
        queryKey: orgScopedKey(orgId, "bugs"),
      });
    }

    if (socket.connected) join();
    socket.on("connect", join);
    socket.on("bug:created", refreshBugs);
    socket.on("bug:updated", refreshBugs);

    return () => {
      socket.emit("org:leave", { orgId });
      socket.off("connect", join);
      socket.off("bug:created", refreshBugs);
      socket.off("bug:updated", refreshBugs);
    };
  }, [accessToken, orgId, queryClient]);
}
