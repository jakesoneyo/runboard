// ARCHITECTURE.md 5장 "쓰기는 REST, 소켓은 브로드캐스트 전용" — 도메인 트랜잭션이 커밋된 *이후*에만
// 이 서비스가 호출돼야 한다(RunsService가 호출부에서 이 규칙을 지킨다). 이 파일 자체는 트랜잭션을
// 전혀 모른다 — 그래야 "커밋 전에 emit"하는 실수가 여기 섞여들 수 없다.
import { Injectable } from '@nestjs/common';
import type { RunStatus } from '@prisma/client';
import { RunSocketRegistry } from './run-socket.registry';
import type { RunCounters } from './lib/run-counters';

export interface CaseRecordedPayload {
  runCaseId: string;
  result: string;
  previousResult: string;
  comment: string | null;
  recordedBy: { id: string; name: string };
  recordedAt: Date | null;
}

export interface StatusChangedPayload {
  runId: string;
  organizationId: string;
  status: RunStatus;
  changedBy: { id: string; name: string };
  at: Date;
}

export interface AssigneesChangedPayload {
  userId: string;
  name: string;
}

export interface BugCreatedPayload {
  bugId: string;
  title: string;
  severity: string;
  runId: string | null;
  reportedBy: { id: string; name: string };
}

export interface BugUpdatedPayload {
  bugId: string;
  title: string;
  status: string;
  severity: string;
  assigneeId: string | null;
  updatedBy: { id: string; name: string };
}

@Injectable()
export class RunEventsService {
  constructor(private readonly sockets: RunSocketRegistry) {}

  emitCaseRecorded(runId: string, payload: CaseRecordedPayload): void {
    this.sockets.server.to(`run:${runId}`).emit('run:case.recorded', payload);
  }

  emitProgressUpdated(runId: string, counters: RunCounters): void {
    this.sockets.server
      .to(`run:${runId}`)
      .emit('run:progress.updated', { runId, ...counters });
  }

  /** API.md 8장: run:status.changed는 run 룸과 org 룸 양쪽에 나간다(대시보드·목록 화면도 갱신되도록). */
  emitStatusChanged(payload: StatusChangedPayload): void {
    const body = {
      runId: payload.runId,
      status: payload.status,
      changedBy: payload.changedBy,
      at: payload.at,
    };
    this.sockets.server
      .to(`run:${payload.runId}`)
      .emit('run:status.changed', body);
    this.sockets.server
      .to(`org:${payload.organizationId}`)
      .emit('run:status.changed', body);
  }

  emitAssigneesChanged(
    runId: string,
    assignees: AssigneesChangedPayload[],
  ): void {
    this.sockets.server
      .to(`run:${runId}`)
      .emit('run:assignees.changed', { runId, assignees });
  }

  /** API.md 8장: 버그 생성은 실행 룸이 아니라 조직 전체(`org:{orgId}`)로 나간다 — 대시보드/버그 목록 화면용. */
  emitBugCreated(organizationId: string, payload: BugCreatedPayload): void {
    this.sockets.server
      .to(`org:${organizationId}`)
      .emit('bug:created', payload);
  }

  /**
   * API.md 8장 표에는 없지만(C4 시점 예약은 bug:created뿐), C5에서 상태/담당자 변경도 실시간으로
   * 반영하기 위해 같은 org 룸에 추가한 이벤트 — bug:created와 동일한 브로드캐스트 패턴 재사용.
   */
  emitBugUpdated(organizationId: string, payload: BugUpdatedPayload): void {
    this.sockets.server
      .to(`org:${organizationId}`)
      .emit('bug:updated', payload);
  }
}
