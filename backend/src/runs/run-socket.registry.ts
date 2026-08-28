// RunEventsService(도메인 서비스 쪽)와 RunsGateway(소켓 쪽) 사이의 순환 의존을 끊기 위한 얇은 매개체.
// RunsGateway가 afterInit에서 자신의 네임스페이스를 등록하고, RunEventsService는 이 레지스트리를 통해서만
// emit 대상을 얻는다 — RunsGateway가 RunsService를(인가 재사용), RunsService가 RunEventsService를,
// RunEventsService가 다시 RunsGateway를 참조하면 DI 순환이 생기기 때문이다.
import { Injectable } from '@nestjs/common';
import type { Namespace } from 'socket.io';

@Injectable()
export class RunSocketRegistry {
  private namespace?: Namespace;

  register(namespace: Namespace): void {
    this.namespace = namespace;
  }

  /** afterInit 이전(부트스트랩 극초반)에는 호출될 일이 없다 — 있다면 배선 순서 버그다. */
  get server(): Namespace {
    if (!this.namespace) {
      throw new Error('소켓 네임스페이스가 아직 초기화되지 않았습니다.');
    }
    return this.namespace;
  }
}
