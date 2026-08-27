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
import { CreateSuiteDto } from './dto/create-suite.schema';
import { ListSuitesQueryDto } from './dto/list-suites-query.schema';
import { UpdateSuiteDto } from './dto/update-suite.schema';
import { SuitesService } from './suites.service';

/**
 * API.md 4장 — 스위트 트리 CRUD.
 * :orgId는 OrgContextGuard가 라우팅 단계에서 ALS 컨텍스트를 채우는 데만 쓰인다 —
 * 서비스 메서드에는 넘기지 않는다(테넌트 스코프는 tenant.extension.ts가 자동 적용).
 */
@ApiTags('suites')
@ApiBearerAuth()
@Controller('orgs/:orgId/suites')
@UseGuards(OrgContextGuard, RolesGuard)
export class SuitesController {
  constructor(private readonly suites: SuitesService) {}

  @Get()
  @ApiOperation({ summary: '스위트 목록/트리 조회 (요구 Role: MEMBER)' })
  list(@Query() query: ListSuitesQueryDto) {
    return this.suites.list(query.tree);
  }

  @Post()
  @RequireRole(Role.QA_LEAD)
  @ApiOperation({
    summary: '스위트 생성 (요구 Role: QA_LEAD+, 4단계 이상이면 400)',
  })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateSuiteDto) {
    return this.suites.create(user.id, dto);
  }

  @Patch(':suiteId')
  @RequireRole(Role.QA_LEAD)
  @ApiOperation({
    summary: '스위트 수정 (요구 Role: QA_LEAD+, 순환 참조면 400)',
  })
  update(@Param('suiteId') suiteId: string, @Body() dto: UpdateSuiteDto) {
    return this.suites.update(suiteId, dto);
  }

  @Delete(':suiteId')
  @HttpCode(204)
  @RequireRole(Role.QA_LEAD)
  @ApiOperation({
    summary: '스위트 삭제 (요구 Role: QA_LEAD+, 하위 스위트·케이스 cascade)',
  })
  async remove(@Param('suiteId') suiteId: string): Promise<void> {
    await this.suites.remove(suiteId);
  }
}
