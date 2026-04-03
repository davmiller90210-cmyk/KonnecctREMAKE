import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { In, Repository } from 'typeorm';

import { ChatCategoryEntity } from 'src/engine/core-modules/chat/chat-category.entity';
import { ChatChannelEntity } from 'src/engine/core-modules/chat/chat-channel.entity';
import { ChatChannelMemberEntity } from 'src/engine/core-modules/chat/chat-channel-member.entity';
import { ChatDmParticipantEntity } from 'src/engine/core-modules/chat/chat-dm-participant.entity';
import { ChatDmThreadEntity } from 'src/engine/core-modules/chat/chat-dm-thread.entity';
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
  peerAgoraUserId: string | null;
};

export type ChatWorkspaceMemberRowDTO = {
  userWorkspaceId: string;
  firstName: string;
  lastName: string;
  email: string;
};

export type ChatLayoutResponse = {
  categories: ChatLayoutCategoryDTO[];
  directThreads: ChatLayoutDmDTO[];
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
    @InjectRepository(ChatDmParticipantEntity)
    private readonly chatDmParticipantRepository: Repository<ChatDmParticipantEntity>,
    @InjectRepository(RoleEntity)
    private readonly roleRepository: Repository<RoleEntity>,
    @InjectRepository(UserWorkspaceEntity)
    private readonly userWorkspaceRepository: Repository<UserWorkspaceEntity>,
    private readonly userRoleService: UserRoleService,
    private readonly chatWorkspaceBootstrapService: ChatWorkspaceBootstrapService,
    private readonly agoraAuthService: AgoraAuthService,
  ) {}

  async getWorkspaceMembersForChat(
    workspaceId: string,
    viewerUserWorkspaceId: string,
  ): Promise<ChatWorkspaceMemberRowDTO[]> {
    const rows = await this.userWorkspaceRepository.find({
      where: { workspaceId },
      relations: ['user'],
      order: { createdAt: 'ASC' },
    });

    return rows
      .filter((uw) => uw.id !== viewerUserWorkspaceId)
      .map((uw) => ({
        userWorkspaceId: uw.id,
        firstName: uw.user?.firstName ?? '',
        lastName: uw.user?.lastName ?? '',
        email: uw.user?.email ?? '',
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
            ),
          ),
      }))
      .filter((category) => category.channels.length > 0);

    const directThreads = await this.loadDirectThreads(
      workspaceId,
      userWorkspaceId,
    );

    return {
      categories: layoutCategories,
      directThreads,
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
        peerAgoraUserId,
      };
    });
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
