import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { SuitesController } from './suites.controller';
import { SuitesService } from './suites.service';

@Module({
  imports: [AuditModule],
  controllers: [SuitesController],
  providers: [SuitesService],
})
export class SuitesModule {}
