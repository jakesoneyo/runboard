import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
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
import { CreateCaseDto, ListCasesQueryDto, UpdateCaseDto } from './case.schema';
import { CasesService } from './cases.service';

/**
 * API.md 4장 — 테스트케이스 CRUD.
 * :orgId는 OrgContextGuard가 ALS 컨텍스트를 채우는 데만 쓰인다 — 서비스에는 넘기지 않는다.
 */
@ApiTags('cases')
@ApiBearerAuth()
@Controller('orgs/:orgId/cases')
@UseGuards(OrgContextGuard, RolesGuard)
export class CasesController {
  constructor(private readonly cases: CasesService) {}

  @Get()
  @ApiOperation({
    summary: '케이스 목록 (요구 Role: MEMBER, steps 제외한 요약 필드)',
  })
  list(@Query() query: ListCasesQueryDto) {
    return this.cases.list(query);
  }

  @Get(':caseId')
  @ApiOperation({ summary: '케이스 상세 (요구 Role: MEMBER, steps 포함)' })
  getOne(@Param('caseId') caseId: string) {
    return this.cases.getOne(caseId);
  }

  @Post()
  @RequireRole(Role.QA_LEAD)
  @ApiOperation({ summary: '케이스 생성 (요구 Role: QA_LEAD+)' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateCaseDto) {
    return this.cases.create(user.id, dto);
  }

  @Patch(':caseId')
  @RequireRole(Role.QA_LEAD)
  @ApiOperation({
    summary:
      '케이스 수정 (요구 Role: QA_LEAD+, CASE_UPDATED 감사로그에 변경 필드만 기록)',
  })
  update(@Param('caseId') caseId: string, @Body() dto: UpdateCaseDto) {
    return this.cases.update(caseId, dto);
  }

  @Delete(':caseId')
  @HttpCode(204)
  @RequireRole(Role.QA_LEAD)
  @ApiOperation({ summary: '케이스 삭제 (요구 Role: QA_LEAD+)' })
  async remove(@Param('caseId') caseId: string): Promise<void> {
    await this.cases.remove(caseId);
  }
}
