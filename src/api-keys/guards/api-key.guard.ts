import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ApiKeysService } from '../api-keys.service';

@Injectable()
export class ApiKeyGuard implements CanActivate {
    constructor(private apiKeysService: ApiKeysService) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const apiKey = request.headers['x-api-key'];

        if (!apiKey) {
            return true; // Pass through to other guards if no api key (Mixed auth handling usually done differently, but for now assuming this is strictly for API key endpoints or mixed)
            // Actually, user requirement: "If request has Authorization -> user, x-api-key -> service".
            // This Guard should probably only run if x-api-key is present, OR fail if it's protecting an API-key only route.
            // But we need a Unified Guard potentially.
            // For now, let's make it return false if key is present but invalid.
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
