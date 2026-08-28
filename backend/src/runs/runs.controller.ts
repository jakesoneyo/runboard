import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
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
import { RunAssignmentGuard } from '../common/guards/run-assignment.guard';
import { CreateRunDto } from './dto/create-run.schema';
import { ListRunCasesQueryDto } from './dto/list-run-cases-query.schema';
import { ListRunsQueryDto } from './dto/list-runs-query.schema';
import { RecordResultDto } from './dto/record-result.schema';
import { UpdateAssigneesDto } from './dto/update-assignees.schema';
import { UpdateRunStatusDto } from './dto/update-run-status.schema';
import { RunsService } from './runs.service';

/**
 * API.md 5장 — 실행(TestRun). :orgId는 OrgContextGuard가 ALS 컨텍스트를 채우는 데만 쓰인다.
 * 결과 기록 엔드포인트만 RunAssignmentGuard가 추가로 붙는다(QA_LEAD+ 또는 배정된 TESTER).
 */
@ApiTags('runs')
@ApiBearerAuth()
@Controller('orgs/:orgId/runs')
@UseGuards(OrgContextGuard, RolesGuard)
export class RunsController {
  constructor(private readonly runs: RunsService) {}

  @Get()
  @ApiOperation({ summary: '실행 목록 (요구 Role: MEMBER)' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListRunsQueryDto,
  ) {
    return this.runs.list(query, user.id);
  }

  @Post()
  @RequireRole(Role.QA_LEAD)
  @ApiOperation({
    summary:
      '실행 생성 (요구 Role: QA_LEAD+, 선택 케이스를 RunCase로 스냅샷, 0건이면 400)',
  })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateRunDto) {
    return this.runs.create(user.id, dto);
  }

  @Get(':runId')
  @ApiOperation({ summary: '실행 상세 (요구 Role: MEMBER)' })
  getOne(@Param('runId') runId: string) {
    return this.runs.getOne(runId);
  }

  @Get(':runId/cases')
  @ApiOperation({ summary: '실행 케이스 목록 (요구 Role: MEMBER)' })
  listCases(
    @Param('runId') runId: string,
    @Query() query: ListRunCasesQueryDto,
  ) {
    return this.runs.listCases(runId, query);
  }

  @Patch(':runId/cases/:runCaseId')
  @RequireRole(Role.TESTER)
  @UseGuards(RunAssignmentGuard)
  @ApiOperation({
    summary:
      '결과 기록 (요구 Role: QA_LEAD+ 또는 배정된 TESTER, IN_PROGRESS 아니면 409, WS 브로드캐스트)',
  })
  recordResult(
    @CurrentUser() user: AuthenticatedUser,
    @Param('runId') runId: string,
    @Param('runCaseId') runCaseId: string,
    @Body() dto: RecordResultDto,
  ) {
    return this.runs.recordResult(runId, runCaseId, user.id, dto);
  }

  @Patch(':runId/status')
  @RequireRole(Role.QA_LEAD)
  @ApiOperation({
    summary:
      '실행 상태 전이 (요구 Role: QA_LEAD+, 규칙 위반 시 409, WS run:status.changed)',
  })
  updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('runId') runId: string,
    @Body() dto: UpdateRunStatusDto,
  ) {
    return this.runs.updateStatus(runId, user.id, dto);
  }

  @Put(':runId/assignees')
  @RequireRole(Role.QA_LEAD)
  @ApiOperation({
    summary:
      '배정자 전체 치환 (요구 Role: QA_LEAD+, 조직 밖 사용자 포함 시 404)',
  })
  updateAssignees(
    @Param('runId') runId: string,
    @Body() dto: UpdateAssigneesDto,
  ) {
    return this.runs.updateAssignees(runId, dto);
  }

  @Get(':runId/cases/:runCaseId/bug-draft')
  @RequireRole(Role.TESTER)
  @ApiOperation({
    summary:
      '버그 초안 프리필 (요구 Role: TESTER+, RunCase 스냅샷 기반, 저장 안 함)',
  })
  bugDraft(
    @Param('runId') runId: string,
    @Param('runCaseId') runCaseId: string,
  ) {
    return this.runs.bugDraft(runId, runCaseId);
  }
}
