import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';

import { ChatCategoryEntity } from 'src/engine/core-modules/chat/chat-category.entity';
import { ChatChannelEntity } from 'src/engine/core-modules/chat/chat-channel.entity';
import { ChatChannelMemberEntity } from 'src/engine/core-modules/chat/chat-channel-member.entity';
import { UserWorkspaceEntity } from 'src/engine/core-modules/user-workspace/user-workspace.entity';
import { RoleEntity } from 'src/engine/metadata-modules/role/role.entity';
import { UserRoleService } from 'src/engine/metadata-modules/user-role/user-role.service';
import { AgoraAuthService } from 'src/modules/agora/agora-auth.service';
import { AgoraChatGroupService } from 'src/modules/agora/agora-chat-group.service';

@Injectable()
export class ChatWorkspaceBootstrapService {
  private readonly logger = new Logger(ChatWorkspaceBootstrapService.name);

  constructor(
    @InjectRepository(ChatCategoryEntity)
    private readonly chatCategoryRepository: Repository<ChatCategoryEntity>,
    @InjectRepository(ChatChannelEntity)
    private readonly chatChannelRepository: Repository<ChatChannelEntity>,
    @InjectRepository(ChatChannelMemberEntity)
    private readonly chatChannelMemberRepository: Repository<ChatChannelMemberEntity>,
    @InjectRepository(UserWorkspaceEntity)
    private readonly userWorkspaceRepository: Repository<UserWorkspaceEntity>,
    @InjectRepository(RoleEntity)
    private readonly roleRepository: Repository<RoleEntity>,
    private readonly userRoleService: UserRoleService,
    private readonly agoraAuthService: AgoraAuthService,
    private readonly agoraChatGroupService: AgoraChatGroupService,
  ) {}

  async ensureDefaultForActivatedWorkspace(
    workspaceId: string,
    creatorUserId: string,
  ): Promise<void> {
    const existing = await this.chatChannelRepository.findOne({
      where: { workspaceId, isDefaultGeneral: true },
    });

    if (existing) {
      return;
    }

    const userWorkspace = await this.userWorkspaceRepository.findOne({
      where: { workspaceId, userId: creatorUserId },
    });

    if (!userWorkspace) {
      this.logger.warn(
        `Chat bootstrap skipped: no userWorkspace for user ${creatorUserId} in workspace ${workspaceId}`,
      );
      return;
    }

    const category = this.chatCategoryRepository.create({
      workspaceId,
      name: 'General',
      position: 0,
    });
    await this.chatCategoryRepository.save(category);

    const channel = this.chatChannelRepository.create({
      workspaceId,
      categoryId: category.id,
      name: 'general',
      slug: 'general',
      visibility: 'public',
      isDefaultGeneral: true,
      position: 0,
      createdByUserId: creatorUserId,
      agoraGroupId: null,
    });
    await this.chatChannelRepository.save(channel);

    const isAdmin = await this.isWorkspaceAdmin(workspaceId, userWorkspace.id);

    await this.chatChannelMemberRepository.save(
      this.chatChannelMemberRepository.create({
        channelId: channel.id,
        userWorkspaceId: userWorkspace.id,
        canRead: true,
        canPost: true,
        canManage: isAdmin,
      }),
    );

    await this.provisionAgoraForGeneralChannel(workspaceId, channel, creatorUserId);

    this.logger.log(
      `[KONNECCT-CHAT] Seeded default #general for workspace ${workspaceId}`,
    );
  }

  private async provisionAgoraForGeneralChannel(
    workspaceId: string,
    channel: ChatChannelEntity,
    ownerUserId: string,
  ): Promise<void> {
    if (!this.agoraChatGroupService.isConfigured) {
      return;
    }

    const ownerScoped = this.agoraAuthService.scopedUserIdFor(ownerUserId, workspaceId);
    await this.agoraAuthService.ensureChatUserRegistered(ownerScoped);

    const allUws = await this.userWorkspaceRepository.find({
      where: { workspaceId },
    });

    const memberScopedIds: string[] = [];

    for (const uw of allUws) {
      const sid = this.agoraAuthService.scopedUserIdFor(uw.userId, workspaceId);
      await this.agoraAuthService.ensureChatUserRegistered(sid);

      if (sid !== ownerScoped) {
        memberScopedIds.push(sid);
      }
    }

    const groupName = `${workspaceId.replace(/-/g, '').slice(0, 8)}-general`.slice(
      0,
      128,
    );

    const groupId = await this.agoraChatGroupService.createGroup({
      groupname: groupName,
      isPublic: true,
      ownerScopedId: ownerScoped,
      memberScopedIds,
    });

    if (groupId) {
      channel.agoraGroupId = groupId;
      await this.chatChannelRepository.save(channel);
    }
  }

  async ensureDefaultIfWorkspaceHasNoChannels(workspaceId: string): Promise<void> {
    const count = await this.chatChannelRepository.count({
      where: { workspaceId },
    });

    if (count > 0) {
      return;
    }

    const firstUserWorkspace = await this.userWorkspaceRepository.findOne({
      where: { workspaceId },
      order: { createdAt: 'ASC' },
    });

    if (!firstUserWorkspace) {
      return;
    }

    await this.ensureDefaultForActivatedWorkspace(
      workspaceId,
      firstUserWorkspace.userId,
    );
  }

  async addUserWorkspaceToPublicChannels(
    workspaceId: string,
    userWorkspaceId: string,
  ): Promise<void> {
    const publicChannels = await this.chatChannelRepository.find({
      where: { workspaceId, visibility: 'public' },
    });

    if (publicChannels.length === 0) {
      return;
    }

    const isAdmin = await this.isWorkspaceAdmin(workspaceId, userWorkspaceId);

    for (const channel of publicChannels) {
      const existing = await this.chatChannelMemberRepository.findOne({
        where: { channelId: channel.id, userWorkspaceId },
      });

      if (existing) {
        continue;
      }

      await this.chatChannelMemberRepository.save(
        this.chatChannelMemberRepository.create({
          channelId: channel.id,
          userWorkspaceId,
          canRead: true,
          canPost: true,
          canManage: isAdmin,
        }),
      );

      if (channel.agoraGroupId) {
        const uw = await this.userWorkspaceRepository.findOne({
          where: { id: userWorkspaceId, workspaceId },
        });

        if (uw) {
          const scoped = this.agoraAuthService.scopedUserIdFor(
            uw.userId,
            workspaceId,
          );
          await this.agoraAuthService.ensureChatUserRegistered(scoped);
          await this.agoraChatGroupService.addUsersToGroup(channel.agoraGroupId, [
            scoped,
          ]);
        }
      }
    }
  }

  private async isWorkspaceAdmin(
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
