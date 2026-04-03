import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';

import { ChatCategoryEntity } from 'src/engine/core-modules/chat/chat-category.entity';
import { ChatChannelEntity } from 'src/engine/core-modules/chat/chat-channel.entity';
import { ChatChannelMemberEntity } from 'src/engine/core-modules/chat/chat-channel-member.entity';
import { ChatDmParticipantEntity } from 'src/engine/core-modules/chat/chat-dm-participant.entity';
import { ChatDmThreadEntity } from 'src/engine/core-modules/chat/chat-dm-thread.entity';
import { UserWorkspaceEntity } from 'src/engine/core-modules/user-workspace/user-workspace.entity';
import { RoleEntity } from 'src/engine/metadata-modules/role/role.entity';
import { UserRoleService } from 'src/engine/metadata-modules/user-role/user-role.service';
import { AgoraAuthService } from 'src/modules/agora/agora-auth.service';
import { AgoraChatGroupService } from 'src/modules/agora/agora-chat-group.service';

const slugify = (raw: string): string => {
  const slug = raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);

  return slug.length > 0 ? slug : 'channel';
};

@Injectable()
export class ChatMutationService {
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
    private readonly agoraAuthService: AgoraAuthService,
    private readonly agoraChatGroupService: AgoraChatGroupService,
  ) {}

  async createWorkspaceCategory(input: {
    workspaceId: string;
    userWorkspaceId: string;
    name: string;
  }): Promise<{ id: string }> {
    const isWorkspaceAdmin = await this.resolveIsWorkspaceAdmin(
      input.workspaceId,
      input.userWorkspaceId,
    );

    if (!isWorkspaceAdmin) {
      throw new ForbiddenException(
        'Only workspace administrators can create categories.',
      );
    }

    const raw = await this.chatCategoryRepository
      .createQueryBuilder('category')
      .select('MAX(category.position)', 'max')
      .where('category.workspaceId = :workspaceId', {
        workspaceId: input.workspaceId,
      })
      .getRawOne<{ max: string | null }>();

    const nextPosition = (raw?.max ? Number.parseInt(raw.max, 10) : -1) + 1;

    const category = this.chatCategoryRepository.create({
      workspaceId: input.workspaceId,
      name: input.name.trim(),
      position: Number.isFinite(nextPosition) ? nextPosition : 0,
    });
    await this.chatCategoryRepository.save(category);

    return { id: category.id };
  }

  async createWorkspaceChannel(input: {
    workspaceId: string;
    creatorUserId: string;
    creatorUserWorkspaceId: string;
    categoryId: string;
    name: string;
    visibility: 'public' | 'private';
    inviteUserWorkspaceIds?: string[];
  }): Promise<{ id: string; slug: string }> {
    const isWorkspaceAdmin = await this.resolveIsWorkspaceAdmin(
      input.workspaceId,
      input.creatorUserWorkspaceId,
    );

    if (input.visibility === 'public' && !isWorkspaceAdmin) {
      throw new ForbiddenException(
        'Only workspace administrators can create public channels.',
      );
    }

    const category = await this.chatCategoryRepository.findOne({
      where: { id: input.categoryId, workspaceId: input.workspaceId },
    });

    if (!category) {
      throw new BadRequestException('Category not found in this workspace.');
    }

    let baseSlug = slugify(input.name);
    let slug = baseSlug;
    let suffix = 0;

    while (
      await this.chatChannelRepository.findOne({
        where: { workspaceId: input.workspaceId, slug },
      })
    ) {
      suffix += 1;
      slug = `${baseSlug}-${suffix}`;
    }

    const channel = this.chatChannelRepository.create({
      workspaceId: input.workspaceId,
      categoryId: category.id,
      name: input.name.trim(),
      slug,
      visibility: input.visibility,
      isDefaultGeneral: false,
      position: 0,
      createdByUserId: input.creatorUserId,
      agoraGroupId: null,
    });
    await this.chatChannelRepository.save(channel);

    const inviteSet = new Set(
      input.inviteUserWorkspaceIds?.filter((id) => id !== input.creatorUserWorkspaceId) ??
        [],
    );

    await this.chatChannelMemberRepository.save(
      this.chatChannelMemberRepository.create({
        channelId: channel.id,
        userWorkspaceId: input.creatorUserWorkspaceId,
        canRead: true,
        canPost: true,
        canManage: true,
      }),
    );

    if (input.visibility === 'private') {
      for (const userWorkspaceId of inviteSet) {
        await this.chatChannelMemberRepository.save(
          this.chatChannelMemberRepository.create({
            channelId: channel.id,
            userWorkspaceId,
            canRead: true,
            canPost: true,
            canManage: false,
          }),
        );
      }
    }

    await this.provisionAgoraGroupForChannel({
      workspaceId: input.workspaceId,
      channel,
      creatorUserId: input.creatorUserId,
      visibility: input.visibility,
      inviteUserWorkspaceIds: [...inviteSet],
      creatorUserWorkspaceId: input.creatorUserWorkspaceId,
    });

    return { id: channel.id, slug: channel.slug };
  }

  private async provisionAgoraGroupForChannel(params: {
    workspaceId: string;
    channel: ChatChannelEntity;
    creatorUserId: string;
    visibility: 'public' | 'private';
    inviteUserWorkspaceIds: string[];
    creatorUserWorkspaceId: string;
  }): Promise<void> {
    if (!this.agoraChatGroupService.isConfigured) {
      return;
    }

    const {
      workspaceId,
      channel,
      creatorUserId,
      visibility,
      inviteUserWorkspaceIds,
      creatorUserWorkspaceId,
    } = params;

    const ownerScoped = this.agoraAuthService.scopedUserIdFor(
      creatorUserId,
      workspaceId,
    );
    await this.agoraAuthService.ensureChatUserRegistered(ownerScoped);

    const scopedSet = new Set<string>();

    if (visibility === 'public') {
      const allUws = await this.userWorkspaceRepository.find({
        where: { workspaceId },
      });

      for (const uw of allUws) {
        const sid = this.agoraAuthService.scopedUserIdFor(uw.userId, workspaceId);
        await this.agoraAuthService.ensureChatUserRegistered(sid);
        scopedSet.add(sid);
      }
    } else {
      const uwsIds = [creatorUserWorkspaceId, ...inviteUserWorkspaceIds];

      for (const uwId of new Set(uwsIds)) {
        const uw = await this.userWorkspaceRepository.findOne({
          where: { id: uwId, workspaceId },
        });

        if (!uw) {
          continue;
        }

        const sid = this.agoraAuthService.scopedUserIdFor(uw.userId, workspaceId);
        await this.agoraAuthService.ensureChatUserRegistered(sid);
        scopedSet.add(sid);
      }
    }

    const memberScopedIds = [...scopedSet].filter((id) => id !== ownerScoped);

    const groupName = `${workspaceId.replace(/-/g, '').slice(0, 8)}-${channel.slug}`
      .slice(0, 128);

    const groupId = await this.agoraChatGroupService.createGroup({
      groupname: groupName,
      isPublic: visibility === 'public',
      ownerScopedId: ownerScoped,
      memberScopedIds,
    });

    if (groupId) {
      channel.agoraGroupId = groupId;
      await this.chatChannelRepository.save(channel);
    }
  }

  async openOrCreateDirectThread(input: {
    workspaceId: string;
    userWorkspaceId: string;
    peerUserWorkspaceId: string;
  }): Promise<{ threadId: string }> {
    if (input.userWorkspaceId === input.peerUserWorkspaceId) {
      throw new BadRequestException('Cannot open a direct thread with yourself.');
    }

    const pairKey = [input.userWorkspaceId, input.peerUserWorkspaceId]
      .sort()
      .join(':');

    const existing = await this.chatDmThreadRepository.findOne({
      where: {
        workspaceId: input.workspaceId,
        kind: 'direct',
        directPairKey: pairKey,
      },
    });

    if (existing) {
      return { threadId: existing.id };
    }

    const thread = this.chatDmThreadRepository.create({
      workspaceId: input.workspaceId,
      kind: 'direct',
      directPairKey: pairKey,
      title: null,
      agoraGroupId: null,
    });
    await this.chatDmThreadRepository.save(thread);

    await this.chatDmParticipantRepository.save([
      this.chatDmParticipantRepository.create({
        threadId: thread.id,
        userWorkspaceId: input.userWorkspaceId,
      }),
      this.chatDmParticipantRepository.create({
        threadId: thread.id,
        userWorkspaceId: input.peerUserWorkspaceId,
      }),
    ]);

    return { threadId: thread.id };
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
