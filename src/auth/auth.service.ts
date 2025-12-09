import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async validateGoogleUser(details: {
    email: string;
    googleId: string;
    accessToken: string;
  }) {
    const user = await this.usersService.findByGoogleId(details.googleId);
    if (user) return user;

    // Check if user exists by email to link account (optional safer logic)
    const existingUser = await this.usersService.findByEmail(details.email);
    if (existingUser) {
      // Link google_id if not present
      if (!existingUser.google_id) {
        existingUser.google_id = details.googleId;
        return this.usersService.create(existingUser);
      }
      return existingUser;
    }

    return this.usersService.create({
      email: details.email,
      google_id: details.googleId,
    });
  }

  async login(user: User) {
    const payload = { email: user.email, sub: user.id };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }
}
