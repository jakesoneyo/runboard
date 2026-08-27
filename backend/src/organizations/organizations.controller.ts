import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
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
import { CreateOrganizationDto } from './dto/create-organization.schema';
import { UpdateOrganizationDto } from './dto/update-organization.schema';
import { OrganizationsService } from './organizations.service';

/** API.md 3장 — 조직 CRUD. */
@ApiTags('organizations')
@ApiBearerAuth()
@Controller('orgs')
export class OrganizationsController {
  constructor(private readonly organizations: OrganizationsService) {}

  @Get()
  @ApiOperation({ summary: '내 Membership 목록' })
  listMine(@CurrentUser() user: AuthenticatedUser) {
    return this.organizations.listMine(user.id);
  }

  @Post()
  @ApiOperation({ summary: '조직 생성 (생성자는 ADMIN)' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateOrganizationDto,
  ) {
    return this.organizations.create(user.id, dto);
  }

  @Get(':orgId')
  @UseGuards(OrgContextGuard, RolesGuard)
  @ApiOperation({ summary: '조직 상세 (요구 Role: MEMBER)' })
  getOne(@Param('orgId') orgId: string) {
    return this.organizations.getOne(orgId);
  }

  @Patch(':orgId')
  @UseGuards(OrgContextGuard, RolesGuard)
  @RequireRole(Role.ADMIN)
  @ApiOperation({ summary: '조직 정보 수정 (요구 Role: ADMIN)' })
  update(@Param('orgId') orgId: string, @Body() dto: UpdateOrganizationDto) {
    return this.organizations.update(orgId, dto);
  }
}
