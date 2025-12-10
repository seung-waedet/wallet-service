import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiKey } from './entities/api-key.entity';
import { createHash } from 'crypto';
import { User } from '../users/entities/user.entity';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class ApiKeysService {
  constructor(
    @InjectRepository(ApiKey)
    private apiKeysRepository: Repository<ApiKey>,
  ) {}

  private hashKey(key: string): string {
    return createHash('sha256').update(key).digest('hex');
  }

  async create(
    user: User,
    name: string,
    permissions: string[],
    expiry: string,
  ) {
    // Check limit
    const activeKeysCount = await this.apiKeysRepository.count({
      where: { user_id: user.id, is_active: true },
    });

    if (activeKeysCount >= 5) {
      throw new BadRequestException(
        'Maximum of 5 active API keys allowed per user.',
      );
    }

    // Generate Key
    const rawKey = `sk_live_${uuidv4().replace(/-/g, '')}`;
    const hashedKey = this.hashKey(rawKey);

    // Calculate Expiry
    const expiresAt = this.calculateExpiry(expiry);

    const apiKey = this.apiKeysRepository.create({
      key: hashedKey,
      permissions,
      expires_at: expiresAt,
      user,
      user_id: user.id,
      is_active: true,
    });

    await this.apiKeysRepository.save(apiKey);

    return {
      api_key: rawKey,
      expires_at: expiresAt,
    };
  }

  async rollover(user: User, expiredKeyId: string, expiry: string) {
    // First, try to find by ID (UUID)
    let expiredKey = await this.apiKeysRepository.findOne({
      where: { id: expiredKeyId, user_id: user.id },
    });

    // If not found by ID, try to find by the key value (in case raw key was sent)
    if (!expiredKey) {
      const hashedKey = this.hashKey(expiredKeyId);
      expiredKey = await this.apiKeysRepository.findOne({
        where: { key: hashedKey, user_id: user.id },
      });
    }

    if (!expiredKey) {
      throw new BadRequestException('Invalid key ID or key not found');
    }

    if (expiredKey.expires_at > new Date()) {
      throw new BadRequestException('Key is not expired yet');
    }

    // Reuse permissions
    return this.create(user, 'Rollover Key', expiredKey.permissions, expiry);
  }

  async getApiKeysForUser(userId: string) {
    const apiKeys = await this.apiKeysRepository.find({
      where: { user_id: userId },
      select: ['id', 'permissions', 'expires_at', 'is_active', 'created_at'], // Don't return the actual key for security
    });

    return apiKeys.map((apiKey) => ({
      id: apiKey.id,
      permissions: apiKey.permissions,
      expires_at: apiKey.expires_at,
      is_active: apiKey.is_active,
      created_at: apiKey.created_at,
    }));
  }

  async validateKey(key: string): Promise<ApiKey | null> {
    const hashedKey = this.hashKey(key);
    const apiKey = await this.apiKeysRepository.findOne({
      where: { key: hashedKey, is_active: true },
      relations: ['user'],
    });

    if (apiKey && apiKey.expires_at > new Date()) {
      return apiKey;
    }
    return null;
  }

  calculateExpiry(expiry: string): Date {
    const date = new Date();
    const unit = expiry.slice(-1);
    const value = parseInt(expiry.slice(0, -1));

    if (isNaN(value)) throw new BadRequestException('Invalid expiry format');

    switch (unit) {
      case 'H':
        date.setHours(date.getHours() + value);
        break;
      case 'D':
        date.setDate(date.getDate() + value);
        break;
      case 'M':
        date.setMonth(date.getMonth() + value);
        break;
      case 'Y':
        date.setFullYear(date.getFullYear() + value);
        break;
      default:
        throw new BadRequestException('Invalid expiry unit. Use H, D, M, Y');
    }
    return date;
  }
}
