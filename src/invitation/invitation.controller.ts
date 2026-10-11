import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard.js';
import type { AuthUser } from '../auth/types/auth-user.js';
import { AcceptInvitationDto } from './dto/accept-invitation.dto.js';
import { GenerateInvitationDto } from './dto/generate-invitation.dto.js';
import { InvitationService } from './invitation.service.js';

type RequestWithOptionalUser = Request & { user?: AuthUser };

@Controller('invitation')
export class InvitationController {
  constructor(private readonly invitationService: InvitationService) {}

  @UseGuards(JwtAuthGuard)
  @Post('generate')
  generate(
    @CurrentUser() user: AuthUser,
    @Body() generateInvitationDto: GenerateInvitationDto,
  ) {
    return this.invitationService.generate(user.id, generateInvitationDto);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Post('accept')
  accept(
    @Body() acceptInvitationDto: AcceptInvitationDto,
    @Req() request: RequestWithOptionalUser,
  ) {
    return this.invitationService.accept(acceptInvitationDto, request.user);
  }
}
