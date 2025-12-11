import {
  Module,
  MiddlewareConsumer,
  NestModule,
  Provider,
} from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthController } from './health.controller';

import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { PaystackModule } from './paystack/paystack.module';
import { ApiKeysModule } from './api-keys/api-keys.module';
import { WalletModule } from './wallet/wallet.module';
import { LoggerMiddleware } from './common/middleware/logger.middleware';
import { HybridAuthGuard } from './auth/guards/hybrid.guard';
import { JwtService } from '@nestjs/jwt';
import { ApiKeysService } from './api-keys/api-keys.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST'),
        port: configService.get<number>('DB_PORT'),
        username: configService.get<string>('DB_USERNAME'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_NAME'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        ssl: {
          rejectUnauthorized: false,
        },
        synchronize: false,
      }),
      inject: [ConfigService],
    }),
    UsersModule,
    AuthModule,
    ApiKeysModule,
    WalletModule,
  ],
  controllers: [AppController, HealthController],
  providers: [
    AppService,
    {
      provide: HybridAuthGuard,
      useFactory: (jwtService: JwtService, apiKeysService: ApiKeysService) => {
        const guard = new HybridAuthGuard();
        guard.setServices(jwtService, apiKeysService);
        return guard;
      },
      inject: [JwtService, ApiKeysService],
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
