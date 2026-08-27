import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { CasesController } from './cases.controller';
import { CasesService } from './cases.service';

@Module({
  imports: [AuditModule],
  controllers: [CasesController],
  providers: [CasesService],
})
export class CasesModule {}
