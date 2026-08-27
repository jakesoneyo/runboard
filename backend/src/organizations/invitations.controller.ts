import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { RequireRole } from '../common/decorators/require-role.decorator';
import { OrgContextGuard } from '../common/guards/org-context.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AcceptInvitationDto } from './dto/accept-invitation.schema';
import { CreateInvitationDto } from './dto/create-invitation.schema';
import { InvitationsService } from './invitations.service';

/**
 * API.md 3장 — 조직 스코프 초대 생성/조회/폐기 (전부 ADMIN).
 * :orgId는 OrgContextGuard가 ALS 컨텍스트를 채우는 데만 쓰인다 — 서비스에는 넘기지 않는다.
 */
@ApiTags('organizations')
@ApiBearerAuth()
@Controller('orgs/:orgId/invitations')
@UseGuards(OrgContextGuard, RolesGuard)
@RequireRole(Role.ADMIN)
export class InvitationsController {
  constructor(private readonly invitations: InvitationsService) {}

  @Post()
  @ApiOperation({ summary: '초대 생성 (요구 Role: ADMIN)' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateInvitationDto,
  ) {
    return this.invitations.create(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: '초대 목록 (요구 Role: ADMIN)' })
  list() {
    return this.invitations.list();
  }

  @Delete(':invitationId')
  @HttpCode(204)
  @ApiOperation({ summary: '초대 폐기 (요구 Role: ADMIN)' })
  async revoke(@Param('invitationId') invitationId: string): Promise<void> {
    await this.invitations.revoke(invitationId);
  }
}

/** API.md 3장 — 초대 수락은 조직 경로 밖(토큰만으로 조직을 알아낸다), 인증만 필요하다. */
@ApiTags('organizations')
@ApiBearerAuth()
@Controller('invitations')
export class InvitationAcceptController {
  constructor(private readonly invitations: InvitationsService) {}

  @Post('accept')
  @ApiOperation({ summary: '초대 수락' })
  accept(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AcceptInvitationDto,
  ) {
    return this.invitations.accept(user, dto.token);
  }
}
