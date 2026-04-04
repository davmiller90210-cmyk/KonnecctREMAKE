import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';

import { KeyValuePairEntity } from 'src/engine/core-modules/key-value-pair/key-value-pair.entity';
import { UserEntity } from 'src/engine/core-modules/user/user.entity';
import { UserWorkspaceEntity } from 'src/engine/core-modules/user-workspace/user-workspace.entity';

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
    TypeOrmModule.forFeature([
      KeyValuePairEntity,
      UserEntity,
      UserWorkspaceEntity,
    ]),
  ],
  providers: [AgoraAuthService],
  controllers: [AgoraAuthController],
  exports: [AgoraAuthService],
})
export class AgoraModule {}
