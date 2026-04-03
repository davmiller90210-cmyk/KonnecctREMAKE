import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { ChatTokenBuilder } from 'agora-token';
import { firstValueFrom } from 'rxjs';

import { AgoraAuthService } from './agora-auth.service';

@Injectable()
export class AgoraChatGroupService {
  private readonly logger = new Logger(AgoraChatGroupService.name);

  private static readonly APP_TOKEN_EXPIRE_SECONDS = 3600;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly agoraAuthService: AgoraAuthService,
  ) {}

  get isConfigured(): boolean {
    return (
      Boolean(this.configService.get<string>('AGORA_CHAT_REST_HOST')) &&
      Boolean(this.configService.get<string>('AGORA_CHAT_ORG_NAME')) &&
      Boolean(this.configService.get<string>('AGORA_CHAT_APP_NAME')) &&
      Boolean(this.configService.get<string>('AGORA_APP_ID')) &&
      Boolean(this.configService.get<string>('AGORA_APP_CERTIFICATE'))
    );
  }

  private buildAppToken(): string {
    const appId = this.configService.get<string>('AGORA_APP_ID') ?? '';
    const appCertificate =
      this.configService.get<string>('AGORA_APP_CERTIFICATE') ?? '';

    return ChatTokenBuilder.buildAppToken(
      appId,
      appCertificate,
      AgoraChatGroupService.APP_TOKEN_EXPIRE_SECONDS,
    );
  }

  private chatApiUrl(suffix: string): string {
    const restHost = this.configService.get<string>('AGORA_CHAT_REST_HOST');
    const orgName = this.configService.get<string>('AGORA_CHAT_ORG_NAME');
    const appName = this.configService.get<string>('AGORA_CHAT_APP_NAME');

    return `https://${restHost}/${orgName}/${appName}${suffix}`;
  }

  private jsonHeaders() {
    return {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${this.buildAppToken()}`,
    };
  }

  /**
   * Creates a Chat group; returns Agora group id, or null if Chat REST is not configured / request fails.
   */
  async createGroup(input: {
    groupname: string;
    isPublic: boolean;
    ownerScopedId: string;
    memberScopedIds: string[];
    maxUsers?: number;
  }): Promise<string | null> {
    if (!this.isConfigured) {
      this.logger.warn('[KONNECCT-AGORA] Chat REST not configured; skipping createGroup');
      return null;
    }

    const members = input.memberScopedIds.filter(
      (id) => id && id !== input.ownerScopedId,
    );

    const url = this.chatApiUrl('/chatgroups');

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          url,
          {
            groupname: input.groupname.slice(0, 128),
            public: input.isPublic,
            maxusers: input.maxUsers ?? 5000,
            owner: input.ownerScopedId,
            members,
          },
          { headers: this.jsonHeaders() },
        ),
      );

      const groupId = response.data?.data?.groupid as string | undefined;

      if (groupId) {
        this.logger.log(`[KONNECCT-AGORA] Created chat group ${groupId}`);
      }

      return groupId ?? null;
    } catch (error) {
      const data = error.response?.data;
      this.logger.warn(
        `[KONNECCT-AGORA] createGroup failed: ${JSON.stringify(data || error.message)}`,
      );

      return null;
    }
  }

  async addUsersToGroup(
    groupId: string,
    scopedUsernames: string[],
  ): Promise<boolean> {
    if (!this.isConfigured || scopedUsernames.length === 0) {
      return false;
    }

    const url = this.chatApiUrl(`/chatgroups/${groupId}/users`);

    try {
      await firstValueFrom(
        this.httpService.post(
          url,
          { usernames: scopedUsernames },
          { headers: this.jsonHeaders() },
        ),
      );

      return true;
    } catch (error) {
      const data = error.response?.data;
      this.logger.warn(
        `[KONNECCT-AGORA] addUsersToGroup failed: ${JSON.stringify(data || error.message)}`,
      );

      return false;
    }
  }
}
