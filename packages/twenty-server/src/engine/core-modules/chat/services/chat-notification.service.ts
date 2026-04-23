import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { In, IsNull, Repository } from 'typeorm';

import { ChatChannelMemberEntity } from 'src/engine/core-modules/chat/chat-channel-member.entity';
import {
  ChatNotificationEntity,
  type ChatNotificationKind,
} from 'src/engine/core-modules/chat/chat-notification.entity';
import { ChatDmParticipantEntity } from 'src/engine/core-modules/chat/chat-dm-participant.entity';
import { type ChatMessageConversationKind } from 'src/engine/core-modules/chat/chat-message.entity';

type ConversationRef = {
  kind: ChatMessageConversationKind;
  id: string;
};

@Injectable()
export class ChatNotificationService {
  constructor(
    @InjectRepository(ChatNotificationEntity)
    private readonly chatNotificationRepository: Repository<ChatNotificationEntity>,
    @InjectRepository(ChatChannelMemberEntity)
    private readonly chatChannelMemberRepository: Repository<ChatChannelMemberEntity>,
    @InjectRepository(ChatDmParticipantEntity)
    private readonly chatDmParticipantRepository: Repository<ChatDmParticipantEntity>,
  ) {}

  async notifyNewMessage(input: {
    workspaceId: string;
    conversation: ConversationRef;
    messageId: string;
    senderUserWorkspaceId: string;
    body: string;
    /** When set (channel only), only these readers receive a notification row (must still be channel members). */
    restrictRecipientsToUserWorkspaceIds?: string[] | null;
  }): Promise<{ recipientUserWorkspaceIds: string[] }> {
    const bodyPreview = input.body.slice(0, 512);
    const kind: ChatNotificationKind =
      input.conversation.kind === 'channel'
        ? 'channel_message'
        : 'dm_message';

    let recipientUserWorkspaceIds: string[] = [];

    if (input.conversation.kind === 'channel') {
      const members = await this.chatChannelMemberRepository.find({
        where: {
          channelId: input.conversation.id,
          canRead: true,
        },
      });
      const baseRecipients = members
        .map((member) => member.userWorkspaceId)
        .filter((id) => id !== input.senderUserWorkspaceId);

      if (input.restrictRecipientsToUserWorkspaceIds?.length) {
        const allow = new Set(input.restrictRecipientsToUserWorkspaceIds);

        recipientUserWorkspaceIds = baseRecipients.filter((id) =>
          allow.has(id),
        );

        if (recipientUserWorkspaceIds.length === 0) {
          recipientUserWorkspaceIds = baseRecipients;
        }
      } else {
        recipientUserWorkspaceIds = baseRecipients;
      }
    } else {
      const participants = await this.chatDmParticipantRepository.find({
        where: { threadId: input.conversation.id },
      });
      recipientUserWorkspaceIds = participants
        .map((participant) => participant.userWorkspaceId)
        .filter((id) => id !== input.senderUserWorkspaceId);
    }

    if (recipientUserWorkspaceIds.length === 0) {
      return { recipientUserWorkspaceIds: [] };
    }

    const rows = recipientUserWorkspaceIds.map((recipientUserWorkspaceId) =>
      this.chatNotificationRepository.create({
        workspaceId: input.workspaceId,
        recipientUserWorkspaceId,
        actorUserWorkspaceId: input.senderUserWorkspaceId,
        kind,
        conversationKind: input.conversation.kind,
        conversationId: input.conversation.id,
        messageId: input.messageId,
        bodyPreview,
        readAt: null,
      }),
    );

    await this.chatNotificationRepository.save(rows);

    return { recipientUserWorkspaceIds };
  }

  /**
   * All workspace members who can read a conversation (channel readers or DM participants).
   * Used to fan out inbox SSE so conversation list previews stay in sync after edits/deletes.
   */
  async listConversationMemberUserWorkspaceIds(input: {
    workspaceId: string;
    conversation: ConversationRef;
  }): Promise<string[]> {
    if (input.conversation.kind === 'channel') {
      const members = await this.chatChannelMemberRepository.find({
        where: {
          channelId: input.conversation.id,
          canRead: true,
        },
      });

      return members.map((member) => member.userWorkspaceId);
    }

    const participants = await this.chatDmParticipantRepository.find({
      where: { threadId: input.conversation.id },
    });

    return participants.map((participant) => participant.userWorkspaceId);
  }

  async countUnread(
    workspaceId: string,
    recipientUserWorkspaceId: string,
  ): Promise<number> {
    return this.chatNotificationRepository.count({
      where: {
        workspaceId,
        recipientUserWorkspaceId,
        readAt: IsNull(),
      },
    });
  }

  async listForRecipient(input: {
    workspaceId: string;
    recipientUserWorkspaceId: string;
    limit?: number;
  }): Promise<{
    notifications: Array<{
      id: string;
      kind: ChatNotificationKind;
      conversationKind: ChatMessageConversationKind;
      conversationId: string;
      messageId: string;
      bodyPreview: string;
      actorUserWorkspaceId: string | null;
      readAt: string | null;
      createdAt: string;
    }>;
  }> {
    const limit = Math.min(Math.max(input.limit ?? 40, 1), 100);
    const rows = await this.chatNotificationRepository.find({
      where: {
        workspaceId: input.workspaceId,
        recipientUserWorkspaceId: input.recipientUserWorkspaceId,
      },
      order: { createdAt: 'DESC' },
      take: limit,
    });

    return {
      notifications: rows.map((row) => ({
        id: row.id,
        kind: row.kind,
        conversationKind: row.conversationKind,
        conversationId: row.conversationId,
        messageId: row.messageId,
        bodyPreview: row.bodyPreview,
        actorUserWorkspaceId: row.actorUserWorkspaceId,
        readAt: row.readAt ? row.readAt.toISOString() : null,
        createdAt: row.createdAt.toISOString(),
      })),
    };
  }

  async markAllRead(
    workspaceId: string,
    recipientUserWorkspaceId: string,
  ): Promise<{ updated: true }> {
    await this.chatNotificationRepository.update(
      {
        workspaceId,
        recipientUserWorkspaceId,
        readAt: IsNull(),
      },
      { readAt: new Date() },
    );

    return { updated: true };
  }

  async markReadByIds(
    workspaceId: string,
    recipientUserWorkspaceId: string,
    ids: string[],
  ): Promise<{ updated: true }> {
    if (ids.length === 0) {
      return { updated: true };
    }

    await this.chatNotificationRepository.update(
      {
        workspaceId,
        recipientUserWorkspaceId,
        id: In(ids),
        readAt: IsNull(),
      },
      { readAt: new Date() },
    );

    return { updated: true };
  }
}
