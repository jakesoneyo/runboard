// ARCHITECTURE.md 5장: Participant는 DB에 저장하지 않는 실시간 개념 — 인메모리(단일 인스턴스 전제)로만
// 관리한다. 확장 시 여러 인스턴스가 생기면 이 상태를 공유할 방법(@socket.io/redis-adapter 등)이
// 필요해진다는 지점을 README에 남긴다(향후 과제).
import { Injectable } from '@nestjs/common';

export interface Participant {
  userId: string;
  name: string;
}

@Injectable()
export class RunPresenceService {
  /** runId -> (socketId -> participant). socketId 단위로 저장해 같은 유저가 여러 탭을 열어도 개별 추적한다. */
  private readonly rooms = new Map<string, Map<string, Participant>>();

  join(runId: string, socketId: string, participant: Participant): void {
    let room = this.rooms.get(runId);
    if (!room) {
      room = new Map();
      this.rooms.set(runId, room);
    }
    room.set(socketId, participant);
  }

  leave(runId: string, socketId: string): void {
    const room = this.rooms.get(runId);
    if (!room) return;
    room.delete(socketId);
    if (room.size === 0) this.rooms.delete(runId);
  }

  /** 연결이 끊긴 소켓을 모든 run 룸에서 제거하고, 실제로 영향을 받은 runId 목록을 돌려준다(재브로드캐스트용). */
  leaveAll(socketId: string): string[] {
    const affected: string[] = [];
    for (const [runId, room] of this.rooms) {
      if (room.delete(socketId)) affected.push(runId);
      if (room.size === 0) this.rooms.delete(runId);
    }
    return affected;
  }

  /** 같은 userId가 여러 소켓(탭)으로 접속해도 Participant 목록에는 한 번만 나타난다(T-18 "중복 조인 없음"). */
  list(runId: string): Participant[] {
    const room = this.rooms.get(runId);
    if (!room) return [];
    const byUser = new Map<string, Participant>();
    for (const participant of room.values()) {
      byUser.set(participant.userId, participant);
    }
    return [...byUser.values()];
  }
}
