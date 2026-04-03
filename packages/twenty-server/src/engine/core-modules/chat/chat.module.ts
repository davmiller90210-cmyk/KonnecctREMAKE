import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';

import { ChatCategoryEntity } from 'src/engine/core-modules/chat/chat-category.entity';
import { ChatChannelEntity } from 'src/engine/core-modules/chat/chat-channel.entity';
import { ChatChannelMemberEntity } from 'src/engine/core-modules/chat/chat-channel-member.entity';
import { ChatDmParticipantEntity } from 'src/engine/core-modules/chat/chat-dm-participant.entity';
import { ChatDmThreadEntity } from 'src/engine/core-modules/chat/chat-dm-thread.entity';
import { ChatController } from 'src/engine/core-modules/chat/controllers/chat.controller';
import { ChatLayoutService } from 'src/engine/core-modules/chat/services/chat-layout.service';
import { ChatMutationService } from 'src/engine/core-modules/chat/services/chat-mutation.service';
import { ChatWorkspaceBootstrapService } from 'src/engine/core-modules/chat/services/chat-workspace-bootstrap.service';
import { UserWorkspaceEntity } from 'src/engine/core-modules/user-workspace/user-workspace.entity';
import { UserEntity } from 'src/engine/core-modules/user/user.entity';
import { RoleEntity } from 'src/engine/metadata-modules/role/role.entity';
import { UserRoleModule } from 'src/engine/metadata-modules/user-role/user-role.module';
import { AgoraModule } from 'src/modules/agora/agora.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ChatCategoryEntity,
      ChatChannelEntity,
      ChatChannelMemberEntity,
      ChatDmThreadEntity,
      ChatDmParticipantEntity,
      UserWorkspaceEntity,
      UserEntity,
      RoleEntity,
    ]),
    JwtModule.register({}),
    UserRoleModule,
    AgoraModule,
  ],
  controllers: [ChatController],
  providers: [
    ChatWorkspaceBootstrapService,
    ChatLayoutService,
    ChatMutationService,
  ],
  exports: [ChatWorkspaceBootstrapService],
})
export class ChatModule {}
