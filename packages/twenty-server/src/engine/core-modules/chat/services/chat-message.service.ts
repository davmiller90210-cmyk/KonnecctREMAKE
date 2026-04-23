import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';

import { DataSource, EntityManager, In, MoreThan, Repository } from 'typeorm';

import { ChatChannelEntity } from 'src/engine/core-modules/chat/chat-channel.entity';
import { ChatChannelMemberEntity } from 'src/engine/core-modules/chat/chat-channel-member.entity';
import { ChatDmParticipantEntity } from 'src/engine/core-modules/chat/chat-dm-participant.entity';
import { ChatDmThreadEntity } from 'src/engine/core-modules/chat/chat-dm-thread.entity';
import { ChatMessageReadEntity } from 'src/engine/core-modules/chat/chat-message-read.entity';
import {
  ChatMessageEntity,
  type ChatMessageConversationKind,
} from 'src/engine/core-modules/chat/chat-message.entity';
import { ChatMessageReactionEntity } from 'src/engine/core-modules/chat/chat-message-reaction.entity';
import { ChatPinnedMessageEntity } from 'src/engine/core-modules/chat/chat-pinned-message.entity';
import { ChatMessageCrmMentionEntity } from 'src/engine/core-modules/chat/chat-message-crm-mention.entity';
import { ChatRecordLinkEntity } from 'src/engine/core-modules/chat/chat-record-link.entity';
import {
  type ChatCrmMentionSnapshotDTO,
  ChatCrmMentionService,
} from 'src/engine/core-modules/chat/services/chat-crm-mention.service';
import { UserWorkspaceEntity } from 'src/engine/core-modules/user-workspace/user-workspace.entity';
import { WorkspaceCacheService } from 'src/engine/workspace-cache/services/workspace-cache.service';
import { TimelineActivityService } from 'src/modules/timeline/services/timeline-activity.service';
import { isDefined } from 'twenty-shared/utils';

type ConversationRef = {
  kind: ChatMessageConversationKind;
  id: string;
};

export type NativeChatReactionSummaryDTO = {
  emoji: string;
  count: number;
  viewerReacted: boolean;
};

export type NativeChatMessageDTO = {
  id: string;
  conversationKind: ChatMessageConversationKind;
  conversationId: string;
  body: string;
  kind: 'text' | 'system';
  createdAt: string;
  editedAt?: string | null;
  isDeleted?: boolean;
  sender: {
    userWorkspaceId: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
  } | null;
  reactions?: NativeChatReactionSummaryDTO[];
  isPinned?: boolean;
  crmMentionSnapshots?: ChatCrmMentionSnapshotDTO[];
};

export type NativeChatPinnedMessageDTO = {
  id: string;
  messageId: string;
  bodyPreview: string;
  createdAt: string;
};

export type NativeChatReadStateDTO = {
  viewerLastReadAt: string | null;
  /** Other participants (excludes viewer) with read cursors for receipts */
  others: Array<{
    userWorkspaceId: string;
    lastReadAt: string | null;
    firstName: string;
    lastName: string;
  }>;
};

export type NativeChatRecordLinkDTO = {
  conversationKind: ChatMessageConversationKind;
  conversationId: string;
  title: string;
  linkedAt: string;
};

@Injectable()
export class ChatMessageService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @InjectRepository(ChatChannelEntity)
    private readonly chatChannelRepository: Repository<ChatChannelEntity>,
    @InjectRepository(ChatChannelMemberEntity)
    private readonly chatChannelMemberRepository: Repository<ChatChannelMemberEntity>,
    @InjectRepository(ChatDmThreadEntity)
    private readonly chatDmThreadRepository: Repository<ChatDmThreadEntity>,
    @InjectRepository(ChatDmParticipantEntity)
    private readonly chatDmParticipantRepository: Repository<ChatDmParticipantEntity>,
    @InjectRepository(ChatMessageEntity)
    private readonly chatMessageRepository: Repository<ChatMessageEntity>,
    @InjectRepository(ChatMessageReadEntity)
    private readonly chatMessageReadRepository: Repository<ChatMessageReadEntity>,
    @InjectRepository(ChatRecordLinkEntity)
    private readonly chatRecordLinkRepository: Repository<ChatRecordLinkEntity>,
    @InjectRepository(ChatMessageReactionEntity)
    private readonly chatMessageReactionRepository: Repository<ChatMessageReactionEntity>,
    @InjectRepository(ChatPinnedMessageEntity)
    private readonly chatPinnedMessageRepository: Repository<ChatPinnedMessageEntity>,
    @InjectRepository(UserWorkspaceEntity)
    private readonly userWorkspaceRepository: Repository<UserWorkspaceEntity>,
    private readonly chatCrmMentionService: ChatCrmMentionService,
    private readonly workspaceCacheService: WorkspaceCacheService,
    private readonly timelineActivityService: TimelineActivityService,
  ) {}

  private messageRepo(manager?: EntityManager) {
    return manager
      ? manager.getRepository(ChatMessageEntity)
      : this.chatMessageRepository;
  }

  private messageReadRepo(manager?: EntityManager) {
    return manager
      ? manager.getRepository(ChatMessageReadEntity)
      : this.chatMessageReadRepository;
  }

  private messageReactionRepo(manager?: EntityManager) {
    return manager
      ? manager.getRepository(ChatMessageReactionEntity)
      : this.chatMessageReactionRepository;
  }

  private pinnedMessageRepo(manager?: EntityManager) {
    return manager
      ? manager.getRepository(ChatPinnedMessageEntity)
      : this.chatPinnedMessageRepository;
  }

  private recordLinkRepo(manager?: EntityManager) {
    return manager
      ? manager.getRepository(ChatRecordLinkEntity)
      : this.chatRecordLinkRepository;
  }

  private async withChatWorkspaceRls<T>(
    workspaceId: string,
    run: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    return this.dataSource.transaction(async (manager) => {
      await manager.query(
        `SELECT set_config('app.current_workspace_id', $1, true)`,
        [workspaceId],
      );

      return run(manager);
    });
  }

  async listMessages(input: {
    workspaceId: string;
    userWorkspaceId: string;
    conversation: ConversationRef;
    limit?: number;
    after?: string;
  }): Promise<{ messages: NativeChatMessageDTO[]; readState: NativeChatReadStateDTO }> {
    await this.assertCanReadConversation(
      input.workspaceId,
      input.userWorkspaceId,
      input.conversation,
    );

    const limit = Math.min(Math.max(input.limit ?? 50, 1), 200);
    const afterDate =
      input.after && !Number.isNaN(Date.parse(input.after))
        ? new Date(input.after)
        : null;

    return this.withChatWorkspaceRls(input.workspaceId, async (manager) => {
      const entities = await this.messageRepo(manager).find({
        where: {
          workspaceId: input.workspaceId,
          conversationKind: input.conversation.kind,
          conversationId: input.conversation.id,
          ...(afterDate ? { createdAt: MoreThan(afterDate) } : {}),
        },
        order: { createdAt: 'ASC' },
        take: limit,
      });

      const senderUserWorkspaceIds = [
        ...new Set(
          entities
            .map((messageEntity) => messageEntity.senderUserWorkspaceId)
            .filter((value): value is string => Boolean(value)),
        ),
      ];

      const senderRows =
        senderUserWorkspaceIds.length > 0
          ? await this.userWorkspaceRepository.find({
              where: {
                workspaceId: input.workspaceId,
                id: In(senderUserWorkspaceIds),
              },
              relations: ['user'],
            })
          : [];

      const senderByUserWorkspaceId = new Map(
        senderRows.map((senderRow) => [senderRow.id, senderRow]),
      );

      const readState = await this.buildReadState(
        input.workspaceId,
        input.userWorkspaceId,
        input.conversation,
        manager,
      );

      const messageIds = entities.map((entity) => entity.id);
      const [reactionsByMessageId, pinnedMessageIds] = await Promise.all([
        this.buildReactionSummaries(
          input.workspaceId,
          messageIds,
          input.userWorkspaceId,
          manager,
        ),
        this.loadPinnedMessageIdSet(input.workspaceId, input.conversation, manager),
      ]);

      const mentionMap =
        await this.chatCrmMentionService.loadMentionSnapshotsForViewer({
          workspaceId: input.workspaceId,
          viewerUserWorkspaceId: input.userWorkspaceId,
          messageIds,
          manager,
        });

      const messages = entities.map((entity) => {
        const dto = this.toMessageDTO(entity, senderByUserWorkspaceId);

        return {
          ...dto,
          reactions: reactionsByMessageId.get(entity.id) ?? [],
          isPinned: pinnedMessageIds.has(entity.id),
          crmMentionSnapshots: mentionMap.get(entity.id) ?? [],
        };
      });

      return {
        messages,
        readState,
      };
    });
  }

  async listPinnedMessages(input: {
    workspaceId: string;
    userWorkspaceId: string;
    conversation: ConversationRef;
  }): Promise<NativeChatPinnedMessageDTO[]> {
    await this.assertCanReadConversation(
      input.workspaceId,
      input.userWorkspaceId,
      input.conversation,
    );

    return this.withChatWorkspaceRls(input.workspaceId, async (manager) => {
      const pins = await this.pinnedMessageRepo(manager).find({
        where: {
          workspaceId: input.workspaceId,
          conversationKind: input.conversation.kind,
          conversationId: input.conversation.id,
        },
        order: { createdAt: 'ASC' },
        take: 8,
      });

      if (pins.length === 0) {
        return [];
      }

      const messagesForPins = await this.messageRepo(manager).find({
        where: {
          workspaceId: input.workspaceId,
          id: In(pins.map((pin) => pin.messageId)),
        },
      });

      const messageById = new Map(
        messagesForPins.map((message) => [message.id, message]),
      );

      return pins.map((pin) => {
        const msg = messageById.get(pin.messageId);

        const bodyPreview = msg?.deletedAt
          ? '[Deleted]'
          : this.previewBody(msg?.body ?? '');

        return {
          id: pin.id,
          messageId: pin.messageId,
          bodyPreview,
          createdAt: pin.createdAt.toISOString(),
        };
      });
    });
  }

  async addMessageReaction(input: {
    workspaceId: string;
    userWorkspaceId: string;
    messageId: string;
    emoji: string;
  }): Promise<ConversationRef> {
    const emojiNorm = this.normalizeReactionEmoji(input.emoji);

    return this.withChatWorkspaceRls(input.workspaceId, async (manager) => {
      const message = await this.messageRepo(manager).findOne({
        where: {
          workspaceId: input.workspaceId,
          id: input.messageId,
        },
      });

      if (!message) {
        throw new NotFoundException('Message not found');
      }

      if (message.deletedAt) {
        throw new BadRequestException('Message was deleted');
      }

      const conversation: ConversationRef = {
        kind: message.conversationKind,
        id: message.conversationId,
      };

      await this.assertCanReadConversation(
        input.workspaceId,
        input.userWorkspaceId,
        conversation,
      );

      const existing = await this.messageReactionRepo(manager).findOne({
        where: {
          workspaceId: input.workspaceId,
          messageId: message.id,
          userWorkspaceId: input.userWorkspaceId,
          emoji: emojiNorm,
        },
      });

      if (!existing) {
        const row = this.messageReactionRepo(manager).create({
          workspaceId: input.workspaceId,
          messageId: message.id,
          userWorkspaceId: input.userWorkspaceId,
          emoji: emojiNorm,
        });
        await this.messageReactionRepo(manager).save(row);
      }

      return conversation;
    });
  }

  async removeMessageReaction(input: {
    workspaceId: string;
    userWorkspaceId: string;
    messageId: string;
    emoji: string;
  }): Promise<ConversationRef> {
    const emojiNorm = this.normalizeReactionEmoji(input.emoji);

    return this.withChatWorkspaceRls(input.workspaceId, async (manager) => {
      const message = await this.messageRepo(manager).findOne({
        where: {
          workspaceId: input.workspaceId,
          id: input.messageId,
        },
      });

      if (!message) {
        throw new NotFoundException('Message not found');
      }

      if (message.deletedAt) {
        throw new BadRequestException('Message was deleted');
      }

      const conversation: ConversationRef = {
        kind: message.conversationKind,
        id: message.conversationId,
      };

      await this.assertCanReadConversation(
        input.workspaceId,
        input.userWorkspaceId,
        conversation,
      );

      await this.messageReactionRepo(manager).delete({
        workspaceId: input.workspaceId,
        messageId: message.id,
        userWorkspaceId: input.userWorkspaceId,
        emoji: emojiNorm,
      });

      return conversation;
    });
  }

  async pinMessage(input: {
    workspaceId: string;
    userWorkspaceId: string;
    messageId: string;
  }): Promise<ConversationRef> {
    return this.withChatWorkspaceRls(input.workspaceId, async (manager) => {
      const message = await this.messageRepo(manager).findOne({
        where: {
          workspaceId: input.workspaceId,
          id: input.messageId,
        },
      });

      if (!message) {
        throw new NotFoundException('Message not found');
      }

      if (message.deletedAt) {
        throw new BadRequestException('Message was deleted');
      }

      const conversation: ConversationRef = {
        kind: message.conversationKind,
        id: message.conversationId,
      };

      await this.assertCanReadConversation(
        input.workspaceId,
        input.userWorkspaceId,
        conversation,
      );

      await this.assertCanPinMessage(
        input.workspaceId,
        input.userWorkspaceId,
        conversation,
      );

      const existingPin = await this.pinnedMessageRepo(manager).findOne({
        where: {
          workspaceId: input.workspaceId,
          conversationKind: conversation.kind,
          conversationId: conversation.id,
          messageId: message.id,
        },
      });

      if (!existingPin) {
        const count = await this.pinnedMessageRepo(manager).count({
          where: {
            workspaceId: input.workspaceId,
            conversationKind: conversation.kind,
            conversationId: conversation.id,
          },
        });

        if (count >= 5) {
          const oldest = await this.pinnedMessageRepo(manager).find({
            where: {
              workspaceId: input.workspaceId,
              conversationKind: conversation.kind,
              conversationId: conversation.id,
            },
            order: { createdAt: 'ASC' },
            take: count - 4,
          });

          for (const row of oldest) {
            await this.pinnedMessageRepo(manager).delete({ id: row.id });
          }
        }

        const pin = this.pinnedMessageRepo(manager).create({
          workspaceId: input.workspaceId,
          conversationKind: conversation.kind,
          conversationId: conversation.id,
          messageId: message.id,
        });
        await this.pinnedMessageRepo(manager).save(pin);
      }

      return conversation;
    });
  }

  async unpinMessage(input: {
    workspaceId: string;
    userWorkspaceId: string;
    messageId: string;
  }): Promise<ConversationRef> {
    return this.withChatWorkspaceRls(input.workspaceId, async (manager) => {
      const message = await this.messageRepo(manager).findOne({
        where: {
          workspaceId: input.workspaceId,
          id: input.messageId,
        },
      });

      if (!message) {
        throw new NotFoundException('Message not found');
      }

      const conversation: ConversationRef = {
        kind: message.conversationKind,
        id: message.conversationId,
      };

      await this.assertCanReadConversation(
        input.workspaceId,
        input.userWorkspaceId,
        conversation,
      );

      await this.assertCanPinMessage(
        input.workspaceId,
        input.userWorkspaceId,
        conversation,
      );

      await this.pinnedMessageRepo(manager).delete({
        workspaceId: input.workspaceId,
        conversationKind: conversation.kind,
        conversationId: conversation.id,
        messageId: message.id,
      });

      return conversation;
    });
  }

  private previewBody(body: string): string {
    const singleLine = body.replace(/\s+/g, ' ').trim();

    return singleLine.length > 120
      ? `${singleLine.slice(0, 117)}…`
      : singleLine;
  }

  private normalizeReactionEmoji(raw: string): string {
    const trimmed = raw.trim();

    if (trimmed.length === 0 || trimmed.length > 128) {
      throw new BadRequestException('Invalid reaction');
    }

    const segmenter = new Intl.Segmenter(undefined, {
      granularity: 'grapheme',
    });
    const graphemeCount = [...segmenter.segment(trimmed)].length;

    if (graphemeCount === 0 || graphemeCount > 16) {
      throw new BadRequestException('Invalid reaction');
    }

    return trimmed;
  }

  private async assertCanPinMessage(
    workspaceId: string,
    userWorkspaceId: string,
    conversation: ConversationRef,
  ): Promise<void> {
    if (conversation.kind === 'channel') {
      const channel = await this.chatChannelRepository.findOne({
        where: { workspaceId, id: conversation.id },
      });

      if (!channel) {
        throw new NotFoundException('Conversation not found');
      }

      const membership = await this.chatChannelMemberRepository.findOne({
        where: {
          channelId: channel.id,
          userWorkspaceId,
        },
      });

      const canPin =
        membership?.canManage === true ||
        (channel.visibility === 'public' && membership?.canPost === true);

      if (!canPin) {
        throw new ForbiddenException('You cannot pin messages in this channel');
      }

      return;
    }

    const participant = await this.chatDmParticipantRepository.findOne({
      where: {
        threadId: conversation.id,
        userWorkspaceId,
      },
    });

    if (!participant) {
      throw new ForbiddenException('You cannot pin messages in this thread');
    }
  }

  private async loadPinnedMessageIdSet(
    workspaceId: string,
    conversation: ConversationRef,
    manager?: EntityManager,
  ): Promise<Set<string>> {
    const pins = await this.pinnedMessageRepo(manager).find({
      where: {
        workspaceId,
        conversationKind: conversation.kind,
        conversationId: conversation.id,
      },
      select: ['messageId'],
    });

    return new Set(pins.map((pin) => pin.messageId));
  }

  private async buildReactionSummaries(
    workspaceId: string,
    messageIds: string[],
    viewerUserWorkspaceId: string,
    manager?: EntityManager,
  ): Promise<Map<string, NativeChatReactionSummaryDTO[]>> {
    const result = new Map<string, NativeChatReactionSummaryDTO[]>();

    if (messageIds.length === 0) {
      return result;
    }

    const rows = await this.messageReactionRepo(manager).find({
      where: {
        workspaceId,
        messageId: In(messageIds),
      },
    });

    const aggregate = new Map<
      string,
      Map<string, { count: number; viewerReacted: boolean }>
    >();

    for (const row of rows) {
      let emojiMap = aggregate.get(row.messageId);

      if (!emojiMap) {
        emojiMap = new Map();
        aggregate.set(row.messageId, emojiMap);
      }

      const bucket = emojiMap.get(row.emoji) ?? {
        count: 0,
        viewerReacted: false,
      };

      bucket.count += 1;

      if (row.userWorkspaceId === viewerUserWorkspaceId) {
        bucket.viewerReacted = true;
      }

      emojiMap.set(row.emoji, bucket);
    }

    for (const [messageId, emojiMap] of aggregate) {
      const summaries: NativeChatReactionSummaryDTO[] = [...emojiMap.entries()]
        .map(([emoji, { count, viewerReacted }]) => ({
          emoji,
          count,
          viewerReacted,
        }))
        .sort((a, b) => b.count - a.count);

      result.set(messageId, summaries);
    }

    return result;
  }

  async buildReadState(
    workspaceId: string,
    viewerUserWorkspaceId: string,
    conversation: ConversationRef,
    manager?: EntityManager,
  ): Promise<NativeChatReadStateDTO> {
    if (!manager) {
      await this.assertCanReadConversation(
        workspaceId,
        viewerUserWorkspaceId,
        conversation,
      );
    }

    const participantUserWorkspaceIds =
      await this.resolveConversationParticipantUserWorkspaceIds(
        workspaceId,
        conversation,
      );

    if (participantUserWorkspaceIds.length === 0) {
      return { viewerLastReadAt: null, others: [] };
    }

    const reads = await this.messageReadRepo(manager).find({
      where: {
        workspaceId,
        conversationKind: conversation.kind,
        conversationId: conversation.id,
        userWorkspaceId: In(participantUserWorkspaceIds),
      },
    });
    const lastReadByUserWorkspaceId = new Map(
      reads.map((row) => [row.userWorkspaceId, row.lastReadAt]),
    );

    const profileRows =
      participantUserWorkspaceIds.length > 0
        ? await this.userWorkspaceRepository.find({
            where: {
              workspaceId,
              id: In(participantUserWorkspaceIds),
            },
            relations: ['user'],
          })
        : [];

    const profileById = new Map(profileRows.map((row) => [row.id, row]));

    const viewerLastReadAt =
      lastReadByUserWorkspaceId.get(viewerUserWorkspaceId) ?? null;

    const others = participantUserWorkspaceIds
      .filter((id) => id !== viewerUserWorkspaceId)
      .map((userWorkspaceId) => {
        const profile = profileById.get(userWorkspaceId);
        const lastReadAt = lastReadByUserWorkspaceId.get(userWorkspaceId) ?? null;

        return {
          userWorkspaceId,
          lastReadAt: lastReadAt ? lastReadAt.toISOString() : null,
          firstName: profile?.user?.firstName ?? '',
          lastName: profile?.user?.lastName ?? '',
        };
      });

    return {
      viewerLastReadAt: viewerLastReadAt
        ? viewerLastReadAt.toISOString()
        : null,
      others,
    };
  }

  private async resolveConversationParticipantUserWorkspaceIds(
    workspaceId: string,
    conversation: ConversationRef,
  ): Promise<string[]> {
    if (conversation.kind === 'channel') {
      const channel = await this.chatChannelRepository.findOne({
        where: { workspaceId, id: conversation.id },
      });

      if (!channel) {
        return [];
      }

      const members = await this.chatChannelMemberRepository.find({
        where: {
          channelId: channel.id,
          canRead: true,
        },
        take: 250,
        order: { createdAt: 'ASC' },
      });

      return members.map((member) => member.userWorkspaceId);
    }

    const participants = await this.chatDmParticipantRepository.find({
      where: { threadId: conversation.id },
    });

    return participants.map((participant) => participant.userWorkspaceId);
  }

  async assertConversationReadable(input: {
    workspaceId: string;
    userWorkspaceId: string;
    conversation: ConversationRef;
  }): Promise<void> {
    await this.assertCanReadConversation(
      input.workspaceId,
      input.userWorkspaceId,
      input.conversation,
    );
  }

  async postMessage(input: {
    workspaceId: string;
    userWorkspaceId: string;
    conversation: ConversationRef;
    body: string;
  }): Promise<NativeChatMessageDTO> {
    await this.assertCanPostConversation(
      input.workspaceId,
      input.userWorkspaceId,
      input.conversation,
    );

    const { createdMessage, mentionRows } = await this.withChatWorkspaceRls(
      input.workspaceId,
      async (manager) => {
        const row = this.messageRepo(manager).create({
          workspaceId: input.workspaceId,
          conversationKind: input.conversation.kind,
          conversationId: input.conversation.id,
          senderUserWorkspaceId: input.userWorkspaceId,
          kind: 'text',
          body: input.body.trim(),
          editedAt: null,
          deletedAt: null,
        });
        await this.messageRepo(manager).save(row);
        await this.chatCrmMentionService.replaceMentionsForMessage(manager, {
          workspaceId: input.workspaceId,
          actorUserWorkspaceId: input.userWorkspaceId,
          messageId: row.id,
          body: row.body,
        });
        await this.markConversationAsRead(
          {
            workspaceId: input.workspaceId,
            userWorkspaceId: input.userWorkspaceId,
            conversation: input.conversation,
            upToMessageId: row.id,
          },
          manager,
        );

        const mentionRepo = manager.getRepository(ChatMessageCrmMentionEntity);
        const rows = await mentionRepo.find({
          where: { workspaceId: input.workspaceId, messageId: row.id },
          order: { createdAt: 'ASC' },
        });

        return { createdMessage: row, mentionRows: rows };
      },
    );

    const sender = await this.userWorkspaceRepository.findOne({
      where: { workspaceId: input.workspaceId, id: input.userWorkspaceId },
      relations: ['user'],
    });

    const mentionMap = await this.chatCrmMentionService.buildSnapshotMapFromRows({
      workspaceId: input.workspaceId,
      viewerUserWorkspaceId: input.userWorkspaceId,
      rows: mentionRows,
    });

    const workspaceMemberId = await this.resolveWorkspaceMemberIdForTimeline(
      input.workspaceId,
      input.userWorkspaceId,
    );

    if (isDefined(workspaceMemberId) && mentionRows.length > 0) {
      let convLabel = 'Chat';

      if (input.conversation.kind === 'channel') {
        const channelEntity = await this.chatChannelRepository.findOne({
          where: { workspaceId: input.workspaceId, id: input.conversation.id },
        });
        convLabel = channelEntity?.name ? `#${channelEntity.name}` : 'Channel';
      } else {
        convLabel = 'Direct message';
      }

      for (const row of mentionRows) {
        let payload: { objectNameSingular: string; recordId: string };

        try {
          payload = JSON.parse(row.snapshotPayload) as {
            objectNameSingular: string;
            recordId: string;
          };
        } catch {
          continue;
        }

        void this.timelineActivityService
          .appendMorphActivityForRecord({
            workspaceId: input.workspaceId,
            workspaceMemberId,
            objectSingularName: payload.objectNameSingular,
            recordId: payload.recordId,
            eventName: 'record.chat-mentioned',
            summary: `Mentioned in ${convLabel}`,
            metadata: {
              messageId: createdMessage.id,
              conversationKind: input.conversation.kind,
              conversationId: input.conversation.id,
            },
          })
          .catch(() => {});
      }
    }

    return {
      ...this.toMessageDTO(
        createdMessage,
        new Map(sender ? [[sender.id, sender]] : []),
      ),
      crmMentionSnapshots: mentionMap.get(createdMessage.id) ?? [],
    };
  }

  async updateMessageText(input: {
    workspaceId: string;
    userWorkspaceId: string;
    messageId: string;
    body: string;
  }): Promise<NativeChatMessageDTO> {
    const trimmed = input.body.trim();

    if (!trimmed) {
      throw new BadRequestException('body is required');
    }

    return this.withChatWorkspaceRls(input.workspaceId, async (manager) => {
      const message = await this.messageRepo(manager).findOne({
        where: { workspaceId: input.workspaceId, id: input.messageId },
      });

      if (!message) {
        throw new NotFoundException('Message not found');
      }

      if (message.kind !== 'text') {
        throw new BadRequestException('Only text messages can be edited');
      }

      if (message.deletedAt) {
        throw new BadRequestException('Message was deleted');
      }

      if (message.senderUserWorkspaceId !== input.userWorkspaceId) {
        throw new ForbiddenException('You can only edit your own messages');
      }

      const conversation: ConversationRef = {
        kind: message.conversationKind,
        id: message.conversationId,
      };

      await this.assertCanReadConversation(
        input.workspaceId,
        input.userWorkspaceId,
        conversation,
      );

      message.body = trimmed;
      message.editedAt = new Date();
      await this.messageRepo(manager).save(message);
      await this.chatCrmMentionService.replaceMentionsForMessage(manager, {
        workspaceId: input.workspaceId,
        actorUserWorkspaceId: input.userWorkspaceId,
        messageId: message.id,
        body: message.body,
      });

      const mentionRepo = manager.getRepository(ChatMessageCrmMentionEntity);
      const mentionRows = await mentionRepo.find({
        where: { workspaceId: input.workspaceId, messageId: message.id },
        order: { createdAt: 'ASC' },
      });

      const senderRows = message.senderUserWorkspaceId
        ? await this.userWorkspaceRepository.find({
            where: {
              workspaceId: input.workspaceId,
              id: message.senderUserWorkspaceId,
            },
            relations: ['user'],
          })
        : [];

      const senderById = new Map(senderRows.map((row) => [row.id, row]));

      const reactions =
        (await this.buildReactionSummaries(
          input.workspaceId,
          [message.id],
          input.userWorkspaceId,
          manager,
        )).get(message.id) ?? [];

      const pinnedIds = await this.loadPinnedMessageIdSet(
        input.workspaceId,
        conversation,
        manager,
      );

      const dto = this.toMessageDTO(message, senderById);

      const mentionMap = await this.chatCrmMentionService.buildSnapshotMapFromRows({
        workspaceId: input.workspaceId,
        viewerUserWorkspaceId: input.userWorkspaceId,
        rows: mentionRows,
      });

      return {
        ...dto,
        reactions,
        isPinned: pinnedIds.has(message.id),
        crmMentionSnapshots: mentionMap.get(message.id) ?? [],
      };
    });
  }

  async softDeleteMessage(input: {
    workspaceId: string;
    userWorkspaceId: string;
    messageId: string;
  }): Promise<ConversationRef> {
    return this.withChatWorkspaceRls(input.workspaceId, async (manager) => {
      const message = await this.messageRepo(manager).findOne({
        where: { workspaceId: input.workspaceId, id: input.messageId },
      });

      if (!message) {
        throw new NotFoundException('Message not found');
      }

      if (message.kind !== 'text') {
        throw new BadRequestException('Only text messages can be deleted');
      }

      if (message.deletedAt) {
        throw new BadRequestException('Message was already deleted');
      }

      if (message.senderUserWorkspaceId !== input.userWorkspaceId) {
        throw new ForbiddenException('You can only delete your own messages');
      }

      const conversation: ConversationRef = {
        kind: message.conversationKind,
        id: message.conversationId,
      };

      await this.assertCanReadConversation(
        input.workspaceId,
        input.userWorkspaceId,
        conversation,
      );

      await this.messageReactionRepo(manager).delete({
        workspaceId: input.workspaceId,
        messageId: message.id,
      });

      await this.pinnedMessageRepo(manager).delete({
        workspaceId: input.workspaceId,
        conversationKind: conversation.kind,
        conversationId: conversation.id,
        messageId: message.id,
      });

      message.body = '';
      message.deletedAt = new Date();
      await this.messageRepo(manager).save(message);

      return conversation;
    });
  }

  async markConversationAsRead(
    input: {
      workspaceId: string;
      userWorkspaceId: string;
      conversation: ConversationRef;
      /** Advance cursor at least through this message’s time (more accurate receipts). */
      upToMessageId?: string | null;
    },
    manager?: EntityManager,
  ): Promise<{ success: true; lastReadAt: string }> {
    const run = async (m: EntityManager) => {
      await this.assertCanReadConversation(
        input.workspaceId,
        input.userWorkspaceId,
        input.conversation,
      );

      let readAt = new Date();

      if (input.upToMessageId?.trim()) {
        const anchor = await this.messageRepo(m).findOne({
          where: {
            workspaceId: input.workspaceId,
            id: input.upToMessageId.trim(),
            conversationKind: input.conversation.kind,
            conversationId: input.conversation.id,
          },
        });

        if (anchor?.createdAt) {
          const anchorTime = anchor.createdAt.getTime();
          readAt = new Date(Math.max(readAt.getTime(), anchorTime));
        }
      }
      const existing = await this.messageReadRepo(m).findOne({
        where: {
          workspaceId: input.workspaceId,
          conversationKind: input.conversation.kind,
          conversationId: input.conversation.id,
          userWorkspaceId: input.userWorkspaceId,
        },
      });

      const previousTime = existing?.lastReadAt?.getTime() ?? 0;
      const finalReadAt = new Date(
        Math.max(readAt.getTime(), previousTime),
      );

      if (!existing) {
        const row = this.messageReadRepo(m).create({
          workspaceId: input.workspaceId,
          conversationKind: input.conversation.kind,
          conversationId: input.conversation.id,
          userWorkspaceId: input.userWorkspaceId,
          lastReadAt: finalReadAt,
        });
        await this.messageReadRepo(m).save(row);
      } else {
        existing.lastReadAt = finalReadAt;
        await this.messageReadRepo(m).save(existing);
      }

      return { success: true as const, lastReadAt: finalReadAt.toISOString() };
    };

    if (manager) {
      return run(manager);
    }

    return this.withChatWorkspaceRls(input.workspaceId, run);
  }

  async linkConversationToRecord(input: {
    workspaceId: string;
    userWorkspaceId: string;
    conversation: ConversationRef;
    objectNameSingular: string;
    recordId: string;
  }): Promise<{ success: true }> {
    await this.assertCanReadConversation(
      input.workspaceId,
      input.userWorkspaceId,
      input.conversation,
    );

    const { created } = await this.withChatWorkspaceRls(
      input.workspaceId,
      async (manager) => {
        const existing = await this.recordLinkRepo(manager).findOne({
          where: {
            workspaceId: input.workspaceId,
            conversationKind: input.conversation.kind,
            conversationId: input.conversation.id,
            linkedObjectNameSingular: input.objectNameSingular,
            linkedRecordId: input.recordId,
          },
        });

        if (!existing) {
          await this.recordLinkRepo(manager).save(
            this.recordLinkRepo(manager).create({
              workspaceId: input.workspaceId,
              conversationKind: input.conversation.kind,
              conversationId: input.conversation.id,
              linkedObjectNameSingular: input.objectNameSingular,
              linkedRecordId: input.recordId,
            }),
          );
        }

        return { created: !existing };
      },
    );

    if (created) {
      const workspaceMemberId = await this.resolveWorkspaceMemberIdForTimeline(
        input.workspaceId,
        input.userWorkspaceId,
      );

      if (isDefined(workspaceMemberId)) {
        let convLabel = 'Chat';

        if (input.conversation.kind === 'channel') {
          const channel = await this.chatChannelRepository.findOne({
            where: {
              workspaceId: input.workspaceId,
              id: input.conversation.id,
            },
          });
          convLabel = channel?.name ? `#${channel.name}` : 'Channel';
        } else {
          convLabel = 'Direct message';
        }

        void this.timelineActivityService
          .appendMorphActivityForRecord({
            workspaceId: input.workspaceId,
            workspaceMemberId,
            objectSingularName: input.objectNameSingular,
            recordId: input.recordId,
            eventName: 'record.chat-linked',
            summary: `Linked conversation ${convLabel}`,
            metadata: {
              conversationKind: input.conversation.kind,
              conversationId: input.conversation.id,
            },
          })
          .catch(() => {});
      }
    }

    return { success: true as const };
  }

  async listRecordChatLinks(input: {
    workspaceId: string;
    userWorkspaceId: string;
    objectNameSingular: string;
    recordId: string;
  }): Promise<{ links: NativeChatRecordLinkDTO[] }> {
    const snapshot = await this.chatCrmMentionService.getViewerRecordSnapshot(
      input.workspaceId,
      input.userWorkspaceId,
      input.objectNameSingular,
      input.recordId,
    );

    if (!snapshot) {
      throw new ForbiddenException('You cannot access this record.');
    }

    const rows = await this.chatRecordLinkRepository.find({
      where: {
        workspaceId: input.workspaceId,
        linkedObjectNameSingular: input.objectNameSingular,
        linkedRecordId: input.recordId,
      },
      order: { createdAt: 'DESC' },
      take: 50,
    });

    const links: NativeChatRecordLinkDTO[] = [];

    for (const row of rows) {
      const conversation: ConversationRef = {
        kind: row.conversationKind,
        id: row.conversationId,
      };

      try {
        await this.assertCanReadConversation(
          input.workspaceId,
          input.userWorkspaceId,
          conversation,
        );
      } catch {
        continue;
      }

      if (row.conversationKind === 'channel') {
        const channel = await this.chatChannelRepository.findOne({
          where: { workspaceId: input.workspaceId, id: row.conversationId },
        });
        links.push({
          conversationKind: 'channel',
          conversationId: row.conversationId,
          title: channel?.name ? `#${channel.name}` : 'Channel',
          linkedAt: row.createdAt.toISOString(),
        });
      } else {
        links.push({
          conversationKind: 'dm',
          conversationId: row.conversationId,
          title: 'Direct message',
          linkedAt: row.createdAt.toISOString(),
        });
      }
    }

    return { links };
  }

  private async assertCanReadConversation(
    workspaceId: string,
    userWorkspaceId: string,
    conversation: ConversationRef,
  ): Promise<void> {
    if (conversation.kind === 'channel') {
      const channel = await this.chatChannelRepository.findOne({
        where: { workspaceId, id: conversation.id },
      });

      if (!channel) {
        throw new NotFoundException('Conversation not found');
      }

      if (channel.visibility === 'public') {
        return;
      }

      const membership = await this.chatChannelMemberRepository.findOne({
        where: {
          channelId: channel.id,
          userWorkspaceId,
        },
      });

      if (!membership?.canRead) {
        throw new ForbiddenException('You cannot access this conversation');
      }

      return;
    }

    const participant = await this.chatDmParticipantRepository.findOne({
      where: {
        threadId: conversation.id,
        userWorkspaceId,
      },
    });

    if (!participant) {
      throw new ForbiddenException('You cannot access this conversation');
    }

    const thread = await this.chatDmThreadRepository.findOne({
      where: {
        id: conversation.id,
        workspaceId,
      },
    });

    if (!thread) {
      throw new NotFoundException('Conversation not found');
    }
  }

  private async resolveWorkspaceMemberIdForTimeline(
    workspaceId: string,
    userWorkspaceId: string,
  ): Promise<string | undefined> {
    const userWorkspace = await this.userWorkspaceRepository.findOne({
      where: { workspaceId, id: userWorkspaceId },
    });

    if (!userWorkspace) {
      return undefined;
    }

    const { flatWorkspaceMemberMaps } =
      await this.workspaceCacheService.getOrRecompute(workspaceId, [
        'flatWorkspaceMemberMaps',
      ]);
    const workspaceMemberId =
      flatWorkspaceMemberMaps.idByUserId[userWorkspace.userId];

    return isDefined(workspaceMemberId) ? workspaceMemberId : undefined;
  }

  private async assertCanPostConversation(
    workspaceId: string,
    userWorkspaceId: string,
    conversation: ConversationRef,
  ): Promise<void> {
    await this.assertCanReadConversation(workspaceId, userWorkspaceId, conversation);

    if (conversation.kind === 'channel') {
      const channel = await this.chatChannelRepository.findOne({
        where: { workspaceId, id: conversation.id },
      });
      if (!channel) {
        throw new NotFoundException('Conversation not found');
      }

      if (channel.visibility === 'public') {
        return;
      }

      const membership = await this.chatChannelMemberRepository.findOne({
        where: {
          channelId: conversation.id,
          userWorkspaceId,
        },
      });

      if (!membership?.canPost) {
        throw new ForbiddenException('You cannot post in this conversation');
      }
    }
  }

  private toMessageDTO(
    entity: ChatMessageEntity,
    senderByUserWorkspaceId: Map<string, UserWorkspaceEntity>,
  ): NativeChatMessageDTO {
    const senderEntity = entity.senderUserWorkspaceId
      ? senderByUserWorkspaceId.get(entity.senderUserWorkspaceId)
      : undefined;

    const isDeleted = Boolean(entity.deletedAt);

    return {
      id: entity.id,
      conversationKind: entity.conversationKind,
      conversationId: entity.conversationId,
      body: isDeleted ? '' : entity.body,
      kind: entity.kind,
      createdAt: entity.createdAt.toISOString(),
      editedAt: entity.editedAt?.toISOString() ?? null,
      isDeleted,
      sender: senderEntity
        ? {
            userWorkspaceId: senderEntity.id,
            firstName: senderEntity.user?.firstName ?? '',
            lastName: senderEntity.user?.lastName ?? '',
            avatarUrl: senderEntity.user?.defaultAvatarUrl ?? null,
          }
        : null,
    };
  }
}
