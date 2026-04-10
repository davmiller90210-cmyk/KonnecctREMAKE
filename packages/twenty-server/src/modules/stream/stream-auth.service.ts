import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StreamChat } from 'stream-chat';

import { UserEntity } from 'src/engine/core-modules/user/user.entity';
import { UserWorkspaceEntity } from 'src/engine/core-modules/user-workspace/user-workspace.entity';

import { AgoraAuthService } from 'src/modules/agora/agora-auth.service';

const MAX_ENSURE_USERS_PER_REQUEST = 64;

@Injectable()
export class StreamAuthService {
  private readonly logger = new Logger(StreamAuthService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly agoraAuthService: AgoraAuthService,
    @InjectRepository(UserWorkspaceEntity)
    private readonly userWorkspaceRepository: Repository<UserWorkspaceEntity>,
  ) {}

  private get apiKey() {
    return this.configService.get<string>('STREAM_API_KEY') ?? '';
  }

  private get apiSecret() {
    return this.configService.get<string>('STREAM_API_SECRET') ?? '';
  }

  get isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiSecret);
  }

  private get serverClient() {
    if (!this.apiKey || !this.apiSecret) {
      throw new Error(
        'Stream is not configured (STREAM_API_KEY, STREAM_API_SECRET).',
      );
    }

    return StreamChat.getInstance(this.apiKey, this.apiSecret);
  }

  displayNameFromUser(user: UserEntity | null | undefined): string {
    if (!user) {
      return '';
    }

    const parts = [user.firstName, user.lastName]
      .map((s) => (s ?? '').trim())
      .filter((s) => s.length > 0);

    if (parts.length > 0) {
      return parts.join(' ');
    }

    return user.email?.trim() || user.id;
  }

  /**
   * Upserts Stream users for the given workspace-scoped ids using Twenty profile data.
   * Only ids that belong to the workspace are processed (others are ignored).
   */
  async ensureScopedUsersForWorkspace(
    workspaceId: string,
    scopedUserIds: string[],
  ): Promise<void> {
    if (!this.isConfigured || scopedUserIds.length === 0) {
      return;
    }

    const requested = [...new Set(scopedUserIds)].slice(
      0,
      MAX_ENSURE_USERS_PER_REQUEST,
    );

    if (requested.length === 0) {
      return;
    }

    const want = new Set(requested);

    try {
      const client = this.serverClient;
      const members = await this.userWorkspaceRepository.find({
        where: { workspaceId },
        relations: ['user'],
      });

      for (const uw of members) {
        if (!uw.user) {
          continue;
        }

        const scoped = this.agoraAuthService.scopedUserIdFor(
          uw.userId,
          workspaceId,
        );

        if (!want.has(scoped)) {
          continue;
        }

        const name = this.displayNameFromUser(uw.user);
        const payload: { id: string; name: string; image?: string } = {
          id: scoped,
          name: name || scoped,
        };

        if (uw.user.defaultAvatarUrl) {
          payload.image = uw.user.defaultAvatarUrl;
        }

        await client.upsertUser(payload);
      }
    } catch (error) {
      this.logger.warn(
        `ensureScopedUsersForWorkspace failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      throw error;
    }
  }

  async createUserToken(
    userId: string,
    profile?: { name?: string; image?: string },
  ) {
    const client = this.serverClient;

    const name = profile?.name?.trim() || userId;
    await client.upsertUser({
      id: userId,
      name,
      ...(profile?.image ? { image: profile.image } : {}),
    });

    const token = client.createToken(userId);

    return {
      apiKey: this.apiKey,
      token,
      userId,
    };
  }

  /**
   * Creates or updates a Stream `messaging` channel whose id matches the workspace chat channel UUID,
   * and ensures all scoped workspace members are channel members.
   */
  async provisionMessagingChannel(params: {
    workspaceId: string;
    channelId: string;
    name: string;
    creatorScopedUserId: string;
    memberScopedUserIds: string[];
  }): Promise<void> {
    if (!this.isConfigured) {
      return;
    }

    const uniqueMembers = [...new Set(params.memberScopedUserIds)];

    if (uniqueMembers.length === 0) {
      return;
    }

    try {
      await this.ensureScopedUsersForWorkspace(
        params.workspaceId,
        uniqueMembers,
      );

      const client = this.serverClient;

      const channel = client.channel('messaging', params.channelId, {
        name: params.name,
        created_by_id: params.creatorScopedUserId,
        konnecctKind: 'channel',
      });

      try {
        await channel.create({
          name: params.name,
          created_by_id: params.creatorScopedUserId,
        });
      } catch (firstError: unknown) {
        const message =
          firstError instanceof Error ? firstError.message : String(firstError);
        const likelyExists =
          message.toLowerCase().includes('already') ||
          message.toLowerCase().includes('exists');
        if (!likelyExists) {
          throw firstError;
        }
      }

      const queried = await channel.query({ state: true });
      const currentIds = new Set(
        (queried.members ?? [])
          .map((m) => m.user_id ?? m.user?.id)
          .filter((id): id is string => typeof id === 'string' && id.length > 0),
      );
      const toAdd = uniqueMembers.filter((id) => !currentIds.has(id));

      if (toAdd.length > 0) {
        await channel.addMembers(toAdd);
      }

      await channel.updatePartial({
        set: { name: params.name },
      });
    } catch (error) {
      this.logger.warn(
        `Stream provisionMessagingChannel failed for ${params.channelId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
