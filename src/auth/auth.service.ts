import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { verifyPassword } from '../common/password.js';
import { UsersService } from '../users/users.service.js';
import { AuthSessionsService } from './auth-sessions.service.js';
import { SignInDto } from './dto/sign-in.dto.js';
import { SignUpDto } from './dto/sign-up.dto.js';
import type { JwtPayload } from './types/auth-user.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly authSessionsService: AuthSessionsService,
    private readonly jwtService: JwtService,
  ) {}

  async signUp(signUpDto: SignUpDto) {
    const account = await this.usersService.createOwnerAccount(signUpDto);
    const identity = await this.usersService.findAuthIdentity(account.user.id);

    if (!identity) {
      throw new UnauthorizedException('Unable to issue access token');
    }

    const session = await this.authSessionsService.createForUser(identity.id);

    const accessToken = await this.createAccessToken({
      sub: identity.id,
      username: identity.username,
      sid: session.id,
    });

    return {
      accessToken,
      ...account,
    };
  }

  async signIn(signInDto: SignInDto) {
    const user = await this.usersService.findByUsername(signInDto.username);

    if (!user) {
      throw new UnauthorizedException('Invalid username or password');
    }

    const passwordMatches = await verifyPassword(
      signInDto.password,
      user.passwordHash,
    );

    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid username or password');
    }

    const session = await this.authSessionsService.createForUser(user.id);

    const accessToken = await this.createAccessToken({
      sub: user.id,
      username: user.username,
      sid: session.id,
    });

    const { passwordHash: _, ...publicUser } = user;

    return {
      accessToken,
      user: publicUser,
    };
  }

  async logout(userId: string, sessionId: string) {
    await this.authSessionsService.revoke(sessionId, userId);

    return {
      message: 'Signed out successfully',
    };
  }

  async getProfile(userId: string) {
    return this.usersService.findOne(userId);
  }

  private createAccessToken(payload: JwtPayload) {
    return this.jwtService.signAsync(payload);
  }
}
