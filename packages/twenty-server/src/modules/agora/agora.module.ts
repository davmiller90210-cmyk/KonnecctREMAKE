import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

import { AgoraAuthService } from './agora-auth.service';
import { AgoraAuthController } from './agora-auth.controller';

/**
 * AgoraModule
 *
 * Provides the backend endpoint to securely generate Agora API tokens.
 */
@Module({
  imports: [
    HttpModule,
    ConfigModule,
    JwtModule.register({}),
  ],
  providers: [AgoraAuthService],
  controllers: [AgoraAuthController],
  exports: [AgoraAuthService],
})
export class AgoraModule {}
