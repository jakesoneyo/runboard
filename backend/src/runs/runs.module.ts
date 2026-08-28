import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { RunAssignmentGuard } from '../common/guards/run-assignment.guard';
import { RunEventsService } from './run-events.service';
import { RunSocketRegistry } from './run-socket.registry';
import { RunsController } from './runs.controller';
import { RunsService } from './runs.service';

@Module({
  imports: [AuditModule],
  controllers: [RunsController],
  providers: [
    RunsService,
    RunEventsService,
    RunSocketRegistry,
    RunAssignmentGuard,
  ],
})
export class RunsModule {}
