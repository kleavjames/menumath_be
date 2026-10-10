import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../../users/users.service.js';
import { AuthSessionsService } from '../auth-sessions.service.js';
import type { AuthUser, JwtPayload } from '../types/auth-user.js';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly usersService: UsersService,
    private readonly authSessionsService: AuthSessionsService,
  ) {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET is not set');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    const user = await this.usersService.findAuthIdentity(payload.sub);

    if (!user) {
      throw new UnauthorizedException();
    }

    const session = await this.authSessionsService.findValidSession(
      payload.sid,
      payload.sub,
    );

    if (!session) {
      throw new UnauthorizedException();
    }

    return {
      id: user.id,
      username: user.username,
      sessionId: session.id,
    };
  }
}
