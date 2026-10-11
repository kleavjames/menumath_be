import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import type { AuthUser } from '../types/auth-user.js';

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  override canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();

    if (!request.headers.authorization) {
      return true;
    }

    return super.canActivate(context);
  }

  override handleRequest<TUser = AuthUser>(
    err: unknown,
    user: TUser,
  ): TUser | undefined {
    if (err) {
      throw err instanceof Error ? err : new UnauthorizedException();
    }

    return user ?? undefined;
  }
}
