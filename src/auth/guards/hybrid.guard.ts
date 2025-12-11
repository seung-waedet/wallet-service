import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { ApiKeysService } from '../../api-keys/api-keys.service';

@Injectable()
export class HybridAuthGuard implements CanActivate {
  // We'll get these services via context or by creating the guard properly
  // For now, we'll use a different approach where services are accessed differently

  private jwtService?: JwtService;
  private apiKeysService?: ApiKeysService;

  // We'll set the services later via setter methods or initialization
  setServices(jwtService: JwtService, apiKeysService: ApiKeysService) {
    this.jwtService = jwtService;
    this.apiKeysService = apiKeysService;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'];

    if (apiKey) {
      // Validate API key if present
      if (!this.apiKeysService) {
        throw new Error('ApiKeysService not initialized in HybridAuthGuard');
      }

      const validKey = await this.apiKeysService.validateKey(apiKey);
      if (!validKey) {
        throw new UnauthorizedException('Invalid or expired API Key');
      }
      request.user = validKey.user;
      request.isService = true;
      request.permissions = validKey.permissions;
      return true;
    }

    // Fallback to JWT authentication
    const token = this.extractTokenFromHeader(request);
    if (!token) {
      throw new UnauthorizedException('Access token required');
    }

    if (!this.jwtService) {
      throw new Error('JwtService not initialized in HybridAuthGuard');
    }

    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_SECRET,
      });
      request.user = { id: payload.sub, email: payload.email };
      request.isService = false; // Mark as user authenticated via JWT
      return true;
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired JWT token');
    }
  }

  private extractTokenFromHeader(request: any): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
