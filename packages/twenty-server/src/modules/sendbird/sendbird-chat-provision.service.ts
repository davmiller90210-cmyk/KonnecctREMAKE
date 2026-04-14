import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ChatChannelEntity } from 'src/engine/core-modules/chat/chat-channel.entity';
import { ChatDmThreadEntity } from 'src/engine/core-modules/chat/chat-dm-thread.entity';
import { UserWorkspaceEntity } from 'src/engine/core-modules/user-workspace/user-workspace.entity';
import { AgoraAuthService } from 'src/modules/agora/agora-auth.service';

import { SendbirdPlatformService } from './sendbird-platform.service';

@Injectable()
export class SendbirdChatProvisionService {
  private readonly logger = new Logger(SendbirdChatProvisionService.name);

  constructor(
    private readonly sendbirdPlatform: SendbirdPlatformService,
    private readonly agoraAuthService: AgoraAuthService,
    @InjectRepository(ChatChannelEntity)
    private readonly chatChannelRepository: Repository<ChatChannelEntity>,
    @InjectRepository(ChatDmThreadEntity)
    private readonly chatDmThreadRepository: Repository<ChatDmThreadEntity>,
    @InjectRepository(UserWorkspaceEntity)
    private readonly userWorkspaceRepository: Repository<UserWorkspaceEntity>,
  ) {}

  get isConfigured(): boolean {
    return this.sendbirdPlatform.isConfigured;
  }

  workspaceChannelUrl(workspaceId: string, channelId: string): string {
    const w = workspaceId.replace(/-/g, '');
    const c = channelId.replace(/-/g, '');
    return `konn_w${w}_c${c}`.slice(0, 190);
  }

  async ensureSendbirdUsersForScopedIds(
    workspaceId: string,
    scopedUserIds: string[],
  ): Promise<void> {
    if (!this.isConfigured || scopedUserIds.length === 0) {
      return;
    }

    const unique = [...new Set(scopedUserIds)];
    const uwsRows = await this.userWorkspaceRepository.find({
      where: { workspaceId },
      relations: ['user'],
    });

    const byScoped = new Map<string, { nickname: string; profileUrl?: string }>();

    for (const uw of uwsRows) {
      const sid = this.agoraAuthService.scopedUserIdFor(uw.userId, workspaceId);
      if (!unique.includes(sid)) {
        continue;
      }

      const u = uw.user;
      const name =
        [u?.firstName, u?.lastName].filter(Boolean).join(' ').trim() ||
        u?.email?.trim() ||
        sid;

      byScoped.set(sid, {
        nickname: name.slice(0, 80),
        ...(u?.defaultAvatarUrl ? { profileUrl: u.defaultAvatarUrl } : {}),
      });
    }

    for (const sid of unique) {
      const meta = byScoped.get(sid) ?? { nickname: sid };

      try {
        await this.sendbirdPlatform.ensureUser({
          userId: sid,
          nickname: meta.nickname,
          profileUrl: meta.profileUrl,
        });
      } catch (error) {
        this.logger.warn(
          `Sendbird ensureUser ${sid}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  async provisionWorkspaceChannel(params: {
    workspaceId: string;
    channel: ChatChannelEntity;
    creatorUserId: string;
    visibility: 'public' | 'private';
    memberScopedUserIds: string[];
  }): Promise<void> {
    if (!this.isConfigured) {
      return;
    }

    const {
      workspaceId,
      channel,
      creatorUserId,
      visibility,
      memberScopedUserIds,
    } = params;

    const uniqueMembers = [...new Set(memberScopedUserIds)];

    if (uniqueMembers.length === 0) {
      return;
    }

    try {
      await this.ensureSendbirdUsersForScopedIds(workspaceId, uniqueMembers);

      const channelUrl = this.workspaceChannelUrl(workspaceId, channel.id);
      const creatorScoped = this.agoraAuthService.scopedUserIdFor(
        creatorUserId,
        workspaceId,
      );

      const firstBatch = uniqueMembers.slice(0, 100);
      const res = await this.sendbirdPlatform.createGroupChannel({
        userIds: firstBatch,
        name: channel.name,
        channelUrl,
        isPublic: visibility === 'public',
        operatorIds: [creatorScoped],
      });

      channel.sendbirdChannelUrl = res.channel_url;
      await this.chatChannelRepository.save(channel);

      for (let i = 100; i < uniqueMembers.length; i += 100) {
        const chunk = uniqueMembers.slice(i, i + 100);
        await this.sendbirdPlatform.inviteUsers(res.channel_url, chunk);
      }

      if (uniqueMembers.length > 100) {
        this.logger.log(
          `Sendbird channel ${res.channel_url}: invited ${uniqueMembers.length - 100} members in follow-up batches`,
        );
      }
    } catch (error) {
      this.logger.warn(
        `Sendbird provisionWorkspaceChannel failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async provisionDirectThread(params: {
    workspaceId: string;
    thread: ChatDmThreadEntity;
    userIdA: string;
    userIdB: string;
  }): Promise<void> {
    if (!this.isConfigured) {
      return;
    }

    const { workspaceId, thread, userIdA, userIdB } = params;
    const a = this.agoraAuthService.scopedUserIdFor(userIdA, workspaceId);
    const b = this.agoraAuthService.scopedUserIdFor(userIdB, workspaceId);

    try {
      await this.ensureSendbirdUsersForScopedIds(workspaceId, [a, b]);

      const res = await this.sendbirdPlatform.createDistinctDirectChannel({
        userIds: [a, b],
      });

      thread.sendbirdChannelUrl = res.channel_url;
      await this.chatDmThreadRepository.save(thread);
    } catch (error) {
      this.logger.warn(
        `Sendbird provisionDirectThread failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async inviteToWorkspaceChannel(
    workspaceId: string,
    channel: ChatChannelEntity,
    newUserIds: string[],
  ): Promise<void> {
    if (!this.isConfigured || !channel.sendbirdChannelUrl || newUserIds.length === 0) {
      return;
    }

    const scoped = newUserIds.map((uid) =>
      this.agoraAuthService.scopedUserIdFor(uid, workspaceId),
    );

    try {
      await this.ensureSendbirdUsersForScopedIds(workspaceId, scoped);
      await this.sendbirdPlatform.inviteUsers(channel.sendbirdChannelUrl, scoped);
    } catch (error) {
      this.logger.warn(
        `Sendbird inviteToWorkspaceChannel failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
