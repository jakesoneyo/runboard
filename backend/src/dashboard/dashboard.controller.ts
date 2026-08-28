import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { OrgContextGuard } from '../common/guards/org-context.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { DashboardService } from './dashboard.service';
import { PassRateTrendQueryDto } from './dto/pass-rate-trend-query.schema';

/** API.md 7장 — 대시보드 집계(조회 전용, MEMBER 누구나). */
@ApiTags('dashboard')
@ApiBearerAuth()
@Controller('orgs/:orgId/dashboard')
@UseGuards(OrgContextGuard, RolesGuard)
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('summary')
  @ApiOperation({
    summary:
      '조직 대시보드 요약 (요구 Role: MEMBER, 쿼리 4회 고정 — DATA-MODEL.md 5장)',
  })
  summary() {
    return this.dashboard.summary();
  }

  @Get('pass-rate-trend')
  @ApiOperation({
    summary: '통과율 추이 (요구 Role: MEMBER, 카운터만 읽음 — 재집계 없음)',
  })
  passRateTrend(@Query() query: PassRateTrendQueryDto) {
    return this.dashboard.passRateTrend(query);
  }
}
