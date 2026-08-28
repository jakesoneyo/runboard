import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../common/decorators/current-user.decorator';
import { RequireRole } from '../common/decorators/require-role.decorator';
import { OrgContextGuard } from '../common/guards/org-context.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { BugsService } from './bugs.service';
import { CreateBugDto } from './dto/create-bug.schema';
import { ListBugsQueryDto } from './dto/list-bugs-query.schema';
import { UpdateBugDto } from './dto/update-bug.schema';

/**
 * API.md 6장 — 버그 리포트. :orgId는 OrgContextGuard가 ALS 컨텍스트를 채우는 데만 쓰인다.
 * RunCase 기반 초안 프리필(GET .../runs/:runId/cases/:runCaseId/bug-draft)은 runs.controller.ts에 남는다
 * (그 경로 자체가 runId/runCaseId에 종속되므로 여기로 옮기지 않는다).
 */
@ApiTags('bugs')
@ApiBearerAuth()
@Controller('orgs/:orgId/bugs')
@UseGuards(OrgContextGuard, RolesGuard)
export class BugsController {
  constructor(private readonly bugs: BugsService) {}

  @Get()
  @ApiOperation({ summary: '버그 목록 (요구 Role: MEMBER)' })
  list(@Query() query: ListBugsQueryDto) {
    return this.bugs.list(query);
  }

  @Get(':bugId')
  @ApiOperation({
    summary: '버그 상세 (요구 Role: MEMBER, 연결된 RunCase 요약 포함)',
  })
  getOne(@Param('bugId') bugId: string) {
    return this.bugs.getOne(bugId);
  }

  @Post()
  @RequireRole(Role.TESTER)
  @ApiOperation({
    summary:
      '버그 생성 (요구 Role: TESTER+, testRunCaseId가 다른 조직 소속이면 404, WS bug:created)',
  })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateBugDto) {
    return this.bugs.create(user.id, dto);
  }

  @Patch(':bugId')
  @RequireRole(Role.QA_LEAD)
  @ApiOperation({
    summary:
      '버그 수정/상태 변경 (요구 Role: QA_LEAD+, status=RESOLVED면 resolvedAt 세팅, WS bug:updated)',
  })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('bugId') bugId: string,
    @Body() dto: UpdateBugDto,
  ) {
    return this.bugs.update(user.id, bugId, dto);
  }
}
