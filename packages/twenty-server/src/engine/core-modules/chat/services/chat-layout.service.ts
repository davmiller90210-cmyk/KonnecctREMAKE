import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { In, Repository } from 'typeorm';

import { ChatCategoryEntity } from 'src/engine/core-modules/chat/chat-category.entity';
import { ChatChannelEntity } from 'src/engine/core-modules/chat/chat-channel.entity';
import { ChatChannelMemberEntity } from 'src/engine/core-modules/chat/chat-channel-member.entity';
import { ChatDmParticipantEntity } from 'src/engine/core-modules/chat/chat-dm-participant.entity';
import { ChatDmThreadEntity } from 'src/engine/core-modules/chat/chat-dm-thread.entity';
import { ChatMessageReadEntity } from 'src/engine/core-modules/chat/chat-message-read.entity';
import { ChatMessageEntity } from 'src/engine/core-modules/chat/chat-message.entity';
import { ChatNotificationService } from 'src/engine/core-modules/chat/services/chat-notification.service';
import { ChatWorkspaceBootstrapService } from 'src/engine/core-modules/chat/services/chat-workspace-bootstrap.service';
import { UserWorkspaceEntity } from 'src/engine/core-modules/user-workspace/user-workspace.entity';
import { RoleEntity } from 'src/engine/metadata-modules/role/role.entity';
import { UserRoleService } from 'src/engine/metadata-modules/user-role/user-role.service';
import { AgoraAuthService } from 'src/modules/agora/agora-auth.service';

export type ChatLayoutChannelDTO = {
  id: string;
  name: string;
  slug: string;
  visibility: 'public' | 'private';
  canRead: boolean;
  canPost: boolean;
  canManage: boolean;
  agoraGroupId: string | null;
  sendbirdChannelUrl: string | null;
  nativeConversationKind: 'channel';
  nativeConversationId: string;
  unreadCount: number;
};

export type ChatLayoutCategoryDTO = {
  id: string;
  name: string;
  position: number;
  channels: ChatLayoutChannelDTO[];
};

export type ChatLayoutDmDTO = {
  id: string;
  kind: 'direct' | 'group';
  title: string | null;
  agoraGroupId: string | null;
  sendbirdChannelUrl: string | null;
  peerAgoraUserId: string | null;
  nativeConversationKind: 'dm';
  nativeConversationId: string;
  unreadCount: number;
};

export type ChatWorkspaceMemberRowDTO = {
  userWorkspaceId: string;
  firstName: string;
  lastName: string;
  email: string;
  /** CRM avatar URL (Sendbird profile_url when provisioned). */
  avatarUrl: string | null;
  /** Stream / Agora-scoped user id (matches `GET /stream/token` user id for this user in this workspace). */
  streamUserId: string;
};

export type ChatLayoutResponse = {
  categories: ChatLayoutCategoryDTO[];
  directThreads: ChatLayoutDmDTO[];
  /** In-app chat notifications (mentions / new messages) not yet marked read */
  notificationUnreadCount: number;
  /** Workspace members for @mentions and participant pickers */
  workspaceMembers: ChatWorkspaceMemberRowDTO[];
  viewer: {
    userWorkspaceId: string;
    isWorkspaceAdmin: boolean;
  };
};

@Injectable()
export class ChatLayoutService {
  constructor(
    @InjectRepository(ChatCategoryEntity)
    private readonly chatCategoryRepository: Repository<ChatCategoryEntity>,
    @InjectRepository(ChatChannelEntity)
    private readonly chatChannelRepository: Repository<ChatChannelEntity>,
    @InjectRepository(ChatChannelMemberEntity)
    private readonly chatChannelMemberRepository: Repository<ChatChannelMemberEntity>,
    @InjectRepository(ChatDmThreadEntity)
    private readonly chatDmThreadRepository: Repository<ChatDmThreadEntity>,
    @InjectRepository(ChatMessageEntity)
    private readonly chatMessageRepository: Repository<ChatMessageEntity>,
    @InjectRepository(ChatMessageReadEntity)
    private readonly chatMessageReadRepository: Repository<ChatMessageReadEntity>,
    @InjectRepository(ChatDmParticipantEntity)
    private readonly chatDmParticipantRepository: Repository<ChatDmParticipantEntity>,
    @InjectRepository(RoleEntity)
    private readonly roleRepository: Repository<RoleEntity>,
    @InjectRepository(UserWorkspaceEntity)
    private readonly userWorkspaceRepository: Repository<UserWorkspaceEntity>,
    private readonly userRoleService: UserRoleService,
    private readonly chatWorkspaceBootstrapService: ChatWorkspaceBootstrapService,
    private readonly chatNotificationService: ChatNotificationService,
    private readonly agoraAuthService: AgoraAuthService,
  ) {}

  async getWorkspaceMembersForChat(
    workspaceId: string,
    _viewerUserWorkspaceId: string,
  ): Promise<ChatWorkspaceMemberRowDTO[]> {
    const rows = await this.userWorkspaceRepository.find({
      where: { workspaceId },
      relations: ['user'],
      order: { createdAt: 'ASC' },
    });

    return rows.map((uw) => ({
      userWorkspaceId: uw.id,
      firstName: uw.user?.firstName ?? '',
      lastName: uw.user?.lastName ?? '',
      email: uw.user?.email ?? '',
      avatarUrl: uw.user?.defaultAvatarUrl ?? null,
      streamUserId: this.agoraAuthService.scopedUserIdFor(
        uw.userId,
        workspaceId,
      ),
    }));
  }

  async getLayout(
    workspaceId: string,
    userWorkspaceId: string,
  ): Promise<ChatLayoutResponse> {
    await this.chatWorkspaceBootstrapService.ensureDefaultIfWorkspaceHasNoChannels(
      workspaceId,
    );

    const isWorkspaceAdmin = await this.resolveIsWorkspaceAdmin(
      workspaceId,
      userWorkspaceId,
    );

    const categories = await this.chatCategoryRepository.find({
      where: { workspaceId },
      order: { position: 'ASC' },
    });

    const allChannels = await this.chatChannelRepository.find({
      where: { workspaceId },
      order: { position: 'ASC' },
    });

    const channelIds = allChannels.map((channel) => channel.id);
    const channelUnreadById = await this.resolveUnreadByConversation(
      workspaceId,
      userWorkspaceId,
      channelIds.map((conversationId) => ({
        conversationKind: 'channel' as const,
        conversationId,
      })),
    );

    const memberRows =
      channelIds.length > 0
        ? await this.chatChannelMemberRepository.find({
            where: {
              userWorkspaceId,
              channelId: In(channelIds),
            },
          })
        : [];
    const memberByChannelId = new Map(
      memberRows.map((row) => [row.channelId, row]),
    );

    const visibleChannels = allChannels.filter((channel) => {
      if (channel.visibility === 'public') {
        return true;
      }

      return memberByChannelId.get(channel.id)?.canRead === true;
    });

    const layoutCategories: ChatLayoutCategoryDTO[] = categories
      .map((category) => ({
        id: category.id,
        name: category.name,
        position: category.position,
        channels: visibleChannels
          .filter((channel) => channel.categoryId === category.id)
          .map((channel) =>
            this.toChannelDTO(
              channel,
              memberByChannelId.get(channel.id) ?? null,
              isWorkspaceAdmin,
              channelUnreadById.get(channel.id) ?? 0,
            ),
          ),
      }))
      .filter((category) => category.channels.length > 0);

    const directThreads = await this.loadDirectThreads(
      workspaceId,
      userWorkspaceId,
    );

    const notificationUnreadCount =
      await this.chatNotificationService.countUnread(
        workspaceId,
        userWorkspaceId,
      );

    const workspaceMembers = await this.getWorkspaceMembersForChat(
      workspaceId,
      userWorkspaceId,
    );

    return {
      categories: layoutCategories,
      directThreads,
      notificationUnreadCount,
      workspaceMembers,
      viewer: {
        userWorkspaceId,
        isWorkspaceAdmin,
      },
    };
  }

  private toChannelDTO(
    channel: ChatChannelEntity,
    member: ChatChannelMemberEntity | null,
    isWorkspaceAdmin: boolean,
    unreadCount: number,
  ): ChatLayoutChannelDTO {
    if (channel.visibility === 'public') {
      return {
        id: channel.id,
        name: channel.name,
        slug: channel.slug,
        visibility: channel.visibility,
        canRead: member?.canRead ?? true,
        canPost: member?.canPost ?? true,
        canManage: member?.canManage ?? isWorkspaceAdmin,
        agoraGroupId: channel.agoraGroupId,
        sendbirdChannelUrl: channel.sendbirdChannelUrl,
        nativeConversationKind: 'channel',
        nativeConversationId: channel.id,
        unreadCount,
      };
    }

    return {
      id: channel.id,
      name: channel.name,
      slug: channel.slug,
      visibility: channel.visibility,
      canRead: member?.canRead === true,
      canPost: member?.canPost === true,
      canManage: member?.canManage === true,
      agoraGroupId: channel.agoraGroupId,
      sendbirdChannelUrl: channel.sendbirdChannelUrl,
      nativeConversationKind: 'channel',
      nativeConversationId: channel.id,
      unreadCount,
    };
  }

  private async loadDirectThreads(
    workspaceId: string,
    userWorkspaceId: string,
  ): Promise<ChatLayoutDmDTO[]> {
    const participantRows = await this.chatDmParticipantRepository.find({
      where: { userWorkspaceId },
    });

    if (participantRows.length === 0) {
      return [];
    }

    const threadIds = [...new Set(participantRows.map((row) => row.threadId))];

    const threads = await this.chatDmThreadRepository.find({
      where: {
        id: In(threadIds),
        workspaceId,
      },
      order: { createdAt: 'DESC' },
    });

    const allParticipants = await this.chatDmParticipantRepository.find({
      where: { threadId: In(threadIds) },
    });

    const participantsByThread = new Map<string, ChatDmParticipantEntity[]>();

    for (const p of allParticipants) {
      const list = participantsByThread.get(p.threadId) ?? [];
      list.push(p);
      participantsByThread.set(p.threadId, list);
    }

    const peerUserWorkspaceIds = new Set<string>();

    for (const thread of threads) {
      if (thread.kind !== 'direct') {
        continue;
      }

      const parts = participantsByThread.get(thread.id) ?? [];
      const peer = parts.find((p) => p.userWorkspaceId !== userWorkspaceId);

      if (peer) {
        peerUserWorkspaceIds.add(peer.userWorkspaceId);
      }
    }

    const peerUwsRows =
      peerUserWorkspaceIds.size > 0
        ? await this.userWorkspaceRepository.find({
            where: { id: In([...peerUserWorkspaceIds]), workspaceId },
          })
        : [];

    const peerUserIdByUwsId = new Map(
      peerUwsRows.map((uw) => [uw.id, uw.userId]),
    );
    const unreadByThreadId = await this.resolveUnreadByConversation(
      workspaceId,
      userWorkspaceId,
      threads.map((thread) => ({
        conversationKind: 'dm' as const,
        conversationId: thread.id,
      })),
    );

    return threads.map((thread) => {
      let peerAgoraUserId: string | null = null;

      if (thread.kind === 'direct') {
        const parts = participantsByThread.get(thread.id) ?? [];
        const peer = parts.find((p) => p.userWorkspaceId !== userWorkspaceId);
        const peerUserId = peer
          ? peerUserIdByUwsId.get(peer.userWorkspaceId)
          : undefined;

        if (peerUserId) {
          peerAgoraUserId = this.agoraAuthService.scopedUserIdFor(
            peerUserId,
            workspaceId,
          );
        }
      }

      return {
        id: thread.id,
        kind: thread.kind,
        title: thread.title,
        agoraGroupId: thread.agoraGroupId,
        sendbirdChannelUrl: thread.sendbirdChannelUrl,
        peerAgoraUserId,
        nativeConversationKind: 'dm',
        nativeConversationId: thread.id,
        unreadCount: unreadByThreadId.get(thread.id) ?? 0,
      };
    });
  }

  private async resolveUnreadByConversation(
    workspaceId: string,
    userWorkspaceId: string,
    conversations: {
      conversationKind: 'channel' | 'dm';
      conversationId: string;
    }[],
  ): Promise<Map<string, number>> {
    if (conversations.length === 0) {
      return new Map();
    }

    const readRows = await this.chatMessageReadRepository.find({
      where: conversations.map((conversation) => ({
        workspaceId,
        userWorkspaceId,
        conversationKind: conversation.conversationKind,
        conversationId: conversation.conversationId,
      })),
    });
    const readByKey = new Map(
      readRows.map((row) => [
        `${row.conversationKind}:${row.conversationId}`,
        row.lastReadAt,
      ]),
    );

    const unreadByConversationId = new Map<string, number>();
    const conversationIdsByKind = conversations.reduce<{
      channel: string[];
      dm: string[];
    }>(
      (accumulator, conversation) => {
        accumulator[conversation.conversationKind].push(conversation.conversationId);
        return accumulator;
      },
      { channel: [], dm: [] },
    );

    for (const conversationKind of ['channel', 'dm'] as const) {
      const conversationIds = conversationIdsByKind[conversationKind];

      if (conversationIds.length === 0) {
        continue;
      }

      const rows = await this.chatMessageRepository
        .createQueryBuilder('message')
        .where('message.workspaceId = :workspaceId', { workspaceId })
        .andWhere('message.conversationKind = :conversationKind', {
          conversationKind,
        })
        .andWhere('message.conversationId IN (:...conversationIds)', {
          conversationIds,
        })
        .andWhere(
          '(message.senderUserWorkspaceId IS NULL OR message.senderUserWorkspaceId != :userWorkspaceId)',
          { userWorkspaceId },
        )
        .getMany();
      const rowsByConversationId = new Map<string, ChatMessageEntity[]>();

      for (const row of rows) {
        const existingRows = rowsByConversationId.get(row.conversationId) ?? [];
        existingRows.push(row);
        rowsByConversationId.set(row.conversationId, existingRows);
      }

      for (const conversationId of conversationIds) {
        const lastReadAt =
          readByKey.get(`${conversationKind}:${conversationId}`) ?? null;
        let count = 0;

        for (const row of rowsByConversationId.get(conversationId) ?? []) {
          if (lastReadAt && !(row.createdAt > lastReadAt)) {
            continue;
          }
          count += 1;
        }

        unreadByConversationId.set(conversationId, count);
      }
    }

    return unreadByConversationId;
  }

  private async resolveIsWorkspaceAdmin(
    workspaceId: string,
    userWorkspaceId: string,
  ): Promise<boolean> {
    try {
      const roleId = await this.userRoleService.getRoleIdForUserWorkspace({
        workspaceId,
        userWorkspaceId,
      });

      const role = await this.roleRepository.findOne({
        where: { id: roleId, workspaceId },
      });

      return role?.canUpdateAllSettings === true;
    } catch {
      return false;
    }
  }
}
