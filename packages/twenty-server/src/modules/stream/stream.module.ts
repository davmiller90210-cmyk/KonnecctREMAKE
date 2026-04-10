import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UserEntity } from 'src/engine/core-modules/user/user.entity';
import { UserWorkspaceEntity } from 'src/engine/core-modules/user-workspace/user-workspace.entity';
import { AgoraModule } from 'src/modules/agora/agora.module';

import { StreamAuthController } from './stream-auth.controller';
import { StreamAuthService } from './stream-auth.service';

@Module({
  imports: [
    HttpModule,
    ConfigModule,
    JwtModule.register({}),
    TypeOrmModule.forFeature([UserEntity, UserWorkspaceEntity]),
    AgoraModule,
  ],
  providers: [StreamAuthService],
  controllers: [StreamAuthController],
  exports: [StreamAuthService],
})
export class StreamModule {}
