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
})
export class RunsModule {}
