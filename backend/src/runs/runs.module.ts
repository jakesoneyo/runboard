import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { RunAssignmentGuard } from '../common/guards/run-assignment.guard';
import { RunEventsService } from './run-events.service';
import { RunPresenceService } from './run-presence.service';
import { RunSocketRegistry } from './run-socket.registry';
import { RunsController } from './runs.controller';
import { RunsGateway } from './runs.gateway';
import { RunsService } from './runs.service';

@Module({
  // AuthModule: RunsGateway가 소켓 핸드셰이크 검증에 JwtService를 재사용하기 위해 임포트한다.
  imports: [AuditModule, AuthModule],
  controllers: [RunsController],
  providers: [
    RunsService,
    RunsGateway,
    RunEventsService,
    RunPresenceService,
    RunSocketRegistry,
    RunAssignmentGuard,
  ],
  // BugsModule이 org 룸 브로드캐스트(bug:created/bug:updated)에 같은 RunEventsService를 재사용한다
  // (PLAN.md C5: "새 소켓 인프라 중복 구현 금지").
  exports: [RunEventsService],
})
export class RunsModule {}
