import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { RequireRole } from '../common/decorators/require-role.decorator';
import { OrgContextGuard } from '../common/guards/org-context.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { UpdateMemberRoleDto } from './dto/update-member-role.schema';
import { MembersService } from './members.service';

/**
 * API.md 3장 — 멤버십 조회/역할 변경/제거.
 * :orgId는 OrgContextGuard가 라우팅 단계에서 읽어 ALS 컨텍스트를 채우는 데만 쓰인다 —
 * 서비스 메서드에는 넘기지 않는다(테넌트 스코프는 확장이 자동으로 적용한다).
 */
@ApiTags('organizations')
@ApiBearerAuth()
@Controller('orgs/:orgId/members')
@UseGuards(OrgContextGuard, RolesGuard)
export class MembersController {
  constructor(private readonly members: MembersService) {}

  @Get()
  @ApiOperation({ summary: '멤버 목록 (요구 Role: MEMBER)' })
  list() {
    return this.members.list();
  }

  @Patch(':userId')
  @RequireRole(Role.ADMIN)
  @ApiOperation({
    summary: '멤버 역할 변경 (요구 Role: ADMIN, 마지막 ADMIN 강등 시 409)',
  })
  updateRole(
    @Param('userId') userId: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.members.updateRole(userId, dto);
  }

  @Delete(':userId')
  @HttpCode(204)
  @RequireRole(Role.ADMIN)
  @ApiOperation({
    summary: '멤버 제거 (요구 Role: ADMIN, 마지막 ADMIN 제거 시 409)',
  })
  async remove(@Param('userId') userId: string): Promise<void> {
    await this.members.remove(userId);
  }
}
