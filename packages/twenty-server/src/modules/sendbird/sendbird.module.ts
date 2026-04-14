import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ChatChannelEntity } from 'src/engine/core-modules/chat/chat-channel.entity';
import { ChatDmThreadEntity } from 'src/engine/core-modules/chat/chat-dm-thread.entity';
import { UserEntity } from 'src/engine/core-modules/user/user.entity';
import { UserWorkspaceEntity } from 'src/engine/core-modules/user-workspace/user-workspace.entity';
import { AgoraModule } from 'src/modules/agora/agora.module';

import { SendbirdAuthController } from './sendbird-auth.controller';
import { SendbirdChatProvisionService } from './sendbird-chat-provision.service';
import { SendbirdPlatformService } from './sendbird-platform.service';

@Module({
  imports: [
    ConfigModule,
    JwtModule.register({}),
    TypeOrmModule.forFeature([
      UserEntity,
      UserWorkspaceEntity,
      ChatChannelEntity,
      ChatDmThreadEntity,
    ]),
    AgoraModule,
  ],
  controllers: [SendbirdAuthController],
  providers: [
    SendbirdPlatformService,
    SendbirdChatProvisionService,
  ],
  exports: [SendbirdPlatformService, SendbirdChatProvisionService],
})
export class SendbirdModule {}
