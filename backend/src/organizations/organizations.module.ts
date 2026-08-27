import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import {
  InvitationAcceptController,
  InvitationsController,
} from './invitations.controller';
import { InvitationsService } from './invitations.service';
import { MembersController } from './members.controller';
import { MembersService } from './members.service';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';

@Module({
  imports: [AuditModule],
  controllers: [
    OrganizationsController,
    MembersController,
    InvitationsController,
    InvitationAcceptController,
  ],
  providers: [OrganizationsService, MembersService, InvitationsService],
})
export class OrganizationsModule {}
