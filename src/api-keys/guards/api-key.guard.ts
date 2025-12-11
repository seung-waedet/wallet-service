import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiKeysService } from '../api-keys.service';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private apiKeysService: ApiKeysService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'];

    if (!apiKey) {
      throw new UnauthorizedException('API Key is required');
    }

    const validKey = await this.apiKeysService.validateKey(apiKey);
    if (!validKey) {
      throw new UnauthorizedException('Invalid or expired API Key');
    }

    // Attach user/service info to request
    request.user = validKey.user; // Treat as user for context
    request.isService = true;
    request.permissions = validKey.permissions;

    return true;
  }
}
