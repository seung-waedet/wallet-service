import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.get<string[]>(
      'permissions',
      context.getHandler(),
    );
    if (!requiredPermissions) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    // If it's a user (JWT), they have all permissions implicitly?
    // Requirement: "JWT users can perform all wallet actions."
    if (request.user && !request.isService) {
      return true;
    }

    // If it's a service (API Key)
    if (request.isService && request.permissions) {
      const hasPermission = requiredPermissions.some((permission) =>
        request.permissions.includes(permission),
      );
      if (!hasPermission) {
        throw new ForbiddenException('Insufficient permissions');
      }
      return true;
    }

    // If neither (should be caught by AuthGuard, but safety net)
    return false;
  }
}
