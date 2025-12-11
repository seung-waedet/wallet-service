import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiKeysService } from '../../api-keys/api-keys.service';

@Injectable()
export class HybridAuthGuard extends AuthGuard('jwt') {
  constructor(private apiKeysService: ApiKeysService) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'];

    if (apiKey) {
      // Validation Logic for API Key
      const validKey = await this.apiKeysService.validateKey(apiKey);
      if (!validKey) {
        throw new UnauthorizedException('Invalid or expired API Key');
      }
      request.user = validKey.user;
      request.isService = true;
      request.permissions = validKey.permissions;
      return true;
    }

    // Fallback to JWT - properly await the parent's canActivate method
    const canActivate = await super.canActivate(context);
    if (canActivate) {
      request.isService = false; // Mark as user authenticated via JWT
      return true;
    } else {
      throw new UnauthorizedException('Unauthorized');
    }
  }
}
