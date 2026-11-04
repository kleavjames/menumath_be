import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { verifyPassword } from '../common/password.js';
import { UsersService } from '../users/users.service.js';
import { AuthSessionsService } from './auth-sessions.service.js';
import { requireDeviceId } from './device-id.js';
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
    const deviceId = requireDeviceId(signUpDto.deviceId);
    const account = await this.usersService.createOwnerAccount(signUpDto);
    const identity = await this.usersService.findAuthIdentity(account.user.id);

    if (!identity) {
      throw new UnauthorizedException('Unable to issue access token');
    }

    const session = await this.authSessionsService.replaceForDevice(
      identity.id,
      deviceId,
    );

    const accessToken = await this.createAccessToken({
      sub: identity.id,
      username: identity.username,
      sid: session.id,
      deviceId,
    });

    const { members: _, ...business } = account.business;

    return {
      accessToken,
      user: account.user,
      membership: account.membership,
      business,
    };
  }

  async signIn(signInDto: SignInDto) {
    const deviceId = requireDeviceId(signInDto.deviceId);
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

    const membership = [...user.memberships].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    )[0];

    if (!membership) {
      throw new UnauthorizedException('User is not a member of a business');
    }

    const session = await this.authSessionsService.replaceForDevice(
      user.id,
      deviceId,
    );

    const accessToken = await this.createAccessToken({
      sub: user.id,
      username: user.username,
      sid: session.id,
      deviceId,
    });

    const { business, ...membershipWithoutBusiness } = membership;
    const {
      passwordHash: _,
      memberships: __,
      ...publicUser
    } = user;

    return {
      accessToken,
      user: publicUser,
      membership: membershipWithoutBusiness,
      business,
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

  async issueAccessTokenForUser(userId: string, deviceId: string) {
    const boundDeviceId = requireDeviceId(deviceId);
    const identity = await this.usersService.findAuthIdentity(userId);

    if (!identity) {
      throw new UnauthorizedException('Unable to issue access token');
    }

    const session = await this.authSessionsService.replaceForDevice(
      identity.id,
      boundDeviceId,
    );

    return this.createAccessToken({
      sub: identity.id,
      username: identity.username,
      sid: session.id,
      deviceId: boundDeviceId,
    });
  }

  private createAccessToken(payload: JwtPayload) {
    return this.jwtService.signAsync(payload);
  }
}
