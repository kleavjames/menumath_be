import { UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../../users/users.service.js';
import { AuthSessionsService } from '../auth-sessions.service.js';
import { JwtStrategy } from './jwt.strategy.js';

describe('JwtStrategy', () => {
  const originalSecret = process.env.JWT_SECRET;

  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret';
  });

  afterEach(() => {
    process.env.JWT_SECRET = originalSecret;
  });

  function createStrategy(options?: {
    user?: { id: string; username: string } | null;
    session?: { id: string; userId: string; deviceId: string } | null;
  }) {
    const usersService = {
      findAuthIdentity: vi.fn().mockResolvedValue(
        options?.user === undefined
          ? { id: 'user-1', username: 'janedoe' }
          : options.user,
      ),
    };
    const authSessionsService = {
      findValidSession: vi.fn().mockResolvedValue(
        options?.session === undefined
          ? { id: 'sid-1', userId: 'user-1', deviceId: 'device-1' }
          : options.session,
      ),
    };

    const strategy = new JwtStrategy(
      usersService as unknown as UsersService,
      authSessionsService as unknown as AuthSessionsService,
    );

    return { strategy, usersService, authSessionsService };
  }

  it('rejects a token that has no deviceId', async () => {
    const { strategy, authSessionsService } = createStrategy();

    await expect(
      strategy.validate({
        sub: 'user-1',
        username: 'janedoe',
        sid: 'sid-1',
        deviceId: '',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(authSessionsService.findValidSession).not.toHaveBeenCalled();
  });

  it('rejects a token when the user does not exist', async () => {
    const { strategy } = createStrategy({ user: null });

    await expect(
      strategy.validate({
        sub: 'user-1',
        username: 'janedoe',
        sid: 'sid-1',
        deviceId: 'device-1',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a token when the session device does not match', async () => {
    const { strategy, authSessionsService } = createStrategy({
      session: null,
    });

    await expect(
      strategy.validate({
        sub: 'user-1',
        username: 'janedoe',
        sid: 'sid-1',
        deviceId: 'other-device',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(authSessionsService.findValidSession).toHaveBeenCalledWith(
      'sid-1',
      'user-1',
      'other-device',
    );
  });

  it('accepts a token whose session id, user, and device match', async () => {
    const { strategy } = createStrategy();

    await expect(
      strategy.validate({
        sub: 'user-1',
        username: 'janedoe',
        sid: 'sid-1',
        deviceId: 'device-1',
      }),
    ).resolves.toEqual({
      id: 'user-1',
      username: 'janedoe',
      sessionId: 'sid-1',
    });
  });
});
