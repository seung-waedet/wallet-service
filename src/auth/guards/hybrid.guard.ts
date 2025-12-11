import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { ApiKeysService } from '../../api-keys/api-keys.service';
import { verify } from 'jsonwebtoken';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class HybridAuthGuard implements CanActivate {
  constructor(private moduleRef: ModuleRef) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'];

    if (apiKey) {
      // Validate API key
      try {
        const apiKeysService = this.moduleRef.get(ApiKeysService, {
          strict: false,
        });
        const validKey = await apiKeysService.validateKey(apiKey);

        if (!validKey) {
          throw new UnauthorizedException('Invalid or expired API Key');
        }

        request.user = validKey.user;
        request.isService = true;
        request.permissions = validKey.permissions;
        return true;
      } catch (e) {
        throw new UnauthorizedException('API Key validation failed');
      }
    } else {
      // Handle JWT authentication manually
      const authHeader = request.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new UnauthorizedException('Access token required');
      }

      const token = authHeader.substring(7);
      try {
        const configService = this.moduleRef.get(ConfigService, {
          strict: false,
        });
        const jwtSecret = configService.get<string>('JWT_SECRET');

        if (!jwtSecret) {
          throw new Error('JWT_SECRET environment variable is not set');
        }

        const payload = verify(token, jwtSecret) as any;
        request.user = { id: payload.sub, email: payload.email };
        request.isService = false; // Mark as user authenticated via JWT
        return true;
      } catch (error) {
        throw new UnauthorizedException('Invalid or expired JWT token');
      }
    }
  }
}
