import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { InvitationController } from './invitation.controller.js';
import { InvitationService } from './invitation.service.js';

@Module({
  imports: [AuthModule],
  controllers: [InvitationController],
  providers: [InvitationService],
})
export class InvitationModule {}
