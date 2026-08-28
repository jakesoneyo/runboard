// API.md 8장 클라이언트 규칙 구현: 이벤트로 캐시를 직접 패치하고, 재연결 시에만 REST로 다시 확인한다.
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { connectSocket } from "../../lib/socket";
import { useOrgStore } from "../../stores/org-store";
import { useAuthStore } from "../../stores/auth-store";
import { useUiStore } from "../../stores/ui-store";
import { runCasesKey, runDetailKey } from "./keys";
import {
  patchRunAssignees,
  patchRunCaseResult,
  patchRunCounters,
} from "./cache";
import type {
  RunCaseResult,
  RunCounters,
  RunParticipant,
  RunSummary,
} from "../../types/api";

interface CaseRecordedEvent {
  runCaseId: string;
  result: RunCaseResult;
  comment: string | null;
  recordedBy: { id: string; name: string };
  recordedAt: string | null;
}

interface JoinAck {
  ok: boolean;
  code?: string;
  participants?: RunParticipant[];
}

/**
 * 실행 보드 실시간 훅. 화면이 마운트된 동안 `run:{runId}` 룸에 머무르며 결과 기록·진행률·
 * 프레즌스·배정자 변경을 즉시 캐시에 반영한다. `connectSocket()`은 AppShell에서 이미 연결한
 * 소켓을 재사용한다(features/realtime/lib/socket.ts).
 */
export function useRunSocket(runId: string) {
  const orgId = useOrgStore((s) => s.currentOrgId);
  const currentUserId = useAuthStore((s) => s.user?.id);
  const showToast = useUiStore((s) => s.showToast);
  const queryClient = useQueryClient();
  const [participants, setParticipants] = useState<RunParticipant[]>([]);
  // 최초 조인은 useQuery가 이미 최신 상태를 가져온 뒤라 재조회가 필요 없다 — "재연결"일 때만
  // REST로 다시 확인한다(API.md 8장, 유실 이벤트 복구).
  const hasJoinedOnceRef = useRef(false);

  useEffect(() => {
    if (!orgId || !runId) return;
    hasJoinedOnceRef.current = false;
    const socket = connectSocket();

    function join() {
      socket.emit("run:join", { orgId, runId }, (ack: JoinAck) => {
        if (ack.ok && ack.participants) setParticipants(ack.participants);
      });
      if (hasJoinedOnceRef.current) {
        void queryClient.invalidateQueries({
          queryKey: runDetailKey(orgId, runId),
        });
        void queryClient.invalidateQueries({
          queryKey: runCasesKey(orgId, runId),
        });
      }
      hasJoinedOnceRef.current = true;
    }

    function onCaseRecorded(payload: CaseRecordedEvent) {
      patchRunCaseResult(queryClient, orgId, runId, {
        id: payload.runCaseId,
        result: payload.result,
        comment: payload.comment,
        recordedBy: payload.recordedBy,
        recordedAt: payload.recordedAt,
      });
      if (payload.recordedBy.id !== currentUserId) {
        showToast(
          `${payload.recordedBy.name}님이 방금 ${payload.result} 기록`,
          "info"
        );
      }
    }

    function onProgressUpdated(payload: RunCounters) {
      patchRunCounters(queryClient, orgId, runId, {
        totalCount: payload.totalCount,
        passedCount: payload.passedCount,
        failedCount: payload.failedCount,
        blockedCount: payload.blockedCount,
        skippedCount: payload.skippedCount,
        progress: payload.progress,
        passRate: payload.passRate,
      });
    }

    function onPresenceUpdated(payload: { participants: RunParticipant[] }) {
      setParticipants(payload.participants);
    }

    function onAssigneesChanged(payload: {
      assignees: RunSummary["assignees"];
    }) {
      patchRunAssignees(queryClient, orgId, runId, payload.assignees);
    }

    if (socket.connected) join();
    socket.on("connect", join);
    socket.on("run:case.recorded", onCaseRecorded);
    socket.on("run:progress.updated", onProgressUpdated);
    socket.on("run:presence.updated", onPresenceUpdated);
    socket.on("run:assignees.changed", onAssigneesChanged);

    return () => {
      socket.emit("run:leave", { orgId, runId });
      socket.off("connect", join);
      socket.off("run:case.recorded", onCaseRecorded);
      socket.off("run:progress.updated", onProgressUpdated);
      socket.off("run:presence.updated", onPresenceUpdated);
      socket.off("run:assignees.changed", onAssigneesChanged);
      setParticipants([]);
    };
  }, [orgId, runId, queryClient, currentUserId, showToast]);

  return { participants };
}
