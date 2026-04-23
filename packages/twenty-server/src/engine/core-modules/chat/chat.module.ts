import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';

import { ChatCategoryEntity } from 'src/engine/core-modules/chat/chat-category.entity';
import { ChatChannelEntity } from 'src/engine/core-modules/chat/chat-channel.entity';
import { ChatChannelMemberEntity } from 'src/engine/core-modules/chat/chat-channel-member.entity';
import { ChatDmParticipantEntity } from 'src/engine/core-modules/chat/chat-dm-participant.entity';
import { ChatDmThreadEntity } from 'src/engine/core-modules/chat/chat-dm-thread.entity';
import { ChatMessageReactionEntity } from 'src/engine/core-modules/chat/chat-message-reaction.entity';
import { ChatMessageReadEntity } from 'src/engine/core-modules/chat/chat-message-read.entity';
import { ChatMessageEntity } from 'src/engine/core-modules/chat/chat-message.entity';
import { ChatPinnedMessageEntity } from 'src/engine/core-modules/chat/chat-pinned-message.entity';
import { ChatNotificationEntity } from 'src/engine/core-modules/chat/chat-notification.entity';
import { ChatRecordLinkEntity } from 'src/engine/core-modules/chat/chat-record-link.entity';
import { ChatController } from 'src/engine/core-modules/chat/controllers/chat.controller';
import { ChatLayoutService } from 'src/engine/core-modules/chat/services/chat-layout.service';
import { ChatMessageService } from 'src/engine/core-modules/chat/services/chat-message.service';
import { ChatMutationService } from 'src/engine/core-modules/chat/services/chat-mutation.service';
import { ChatNotificationService } from 'src/engine/core-modules/chat/services/chat-notification.service';
import { ChatGiphyService } from 'src/engine/core-modules/chat/services/chat-giphy.service';
import { ChatRealtimeService } from 'src/engine/core-modules/chat/services/chat-realtime.service';
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
      ChatMessageEntity,
      ChatMessageReactionEntity,
      ChatMessageReadEntity,
      ChatNotificationEntity,
      ChatPinnedMessageEntity,
      ChatRecordLinkEntity,
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
    ChatMessageService,
    ChatMutationService,
    ChatNotificationService,
    ChatRealtimeService,
    ChatGiphyService,
  ],
  exports: [ChatWorkspaceBootstrapService],
})
export class ChatModule {}
