import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StreamChat } from 'stream-chat';

@Injectable()
export class StreamAuthService {
  private readonly logger = new Logger(StreamAuthService.name);

  constructor(private readonly configService: ConfigService) {}

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

  async createUserToken(userId: string) {
    const client = this.serverClient;

    await client.upsertUser({
      id: userId,
      name: userId,
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
      const client = this.serverClient;

      for (const id of uniqueMembers) {
        await client.upsertUser({ id, name: id });
      }

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
