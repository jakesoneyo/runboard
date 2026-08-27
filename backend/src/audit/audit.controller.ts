import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { OrgContextGuard } from '../common/guards/org-context.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { RequireRole } from '../common/decorators/require-role.decorator';
import { AuditQueryService } from './audit-query.service';
import { ListAuditLogsDto } from './dto/list-audit-logs.schema';

/** API.md 7장 — 감사로그 조회(생성/수정/삭제 API 없음, ADMIN 전용). */
@ApiTags('audit')
@ApiBearerAuth()
@Controller('orgs/:orgId/audit-logs')
@UseGuards(OrgContextGuard, RolesGuard)
export class AuditController {
  constructor(private readonly auditQuery: AuditQueryService) {}

  @Get()
  @RequireRole(Role.ADMIN)
  @ApiOperation({ summary: '감사로그 조회 (요구 Role: ADMIN)' })
  list(@Param('orgId') orgId: string, @Query() query: ListAuditLogsDto) {
    return this.auditQuery.list(orgId, query);
  }
}
