import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { RunsModule } from '../runs/runs.module';
import { BugsController } from './bugs.controller';
import { BugsService } from './bugs.service';

@Module({
  // RunsModule: bug:created/bug:updated 브로드캐스트에 RunEventsService(소켓 레지스트리)를 재사용한다.
  imports: [AuditModule, RunsModule],
  controllers: [BugsController],
  providers: [BugsService],
})
export class BugsModule {}
