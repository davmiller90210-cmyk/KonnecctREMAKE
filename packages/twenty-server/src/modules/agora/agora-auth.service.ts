import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { InjectRepository } from '@nestjs/typeorm';
import { createClerkClient } from '@clerk/backend';
import { ChatTokenBuilder } from 'agora-token';
import { createHash } from 'crypto';
import { firstValueFrom } from 'rxjs';
import { IsNull, Repository } from 'typeorm';

import { KeyValuePairEntity, KeyValuePairType } from 'src/engine/core-modules/key-value-pair/key-value-pair.entity';
import { UserEntity } from 'src/engine/core-modules/user/user.entity';
import { UserWorkspaceEntity } from 'src/engine/core-modules/user-workspace/user-workspace.entity';

@Injectable()
export class AgoraAuthService {
  private readonly logger = new Logger(AgoraAuthService.name);

  private static readonly CHAT_USER_TOKEN_EXPIRE_SECONDS = 24 * 3600;
  private static readonly APP_TOKEN_EXPIRE_SECONDS = 3600;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    @InjectRepository(KeyValuePairEntity)
    private readonly keyValuePairRepository: Repository<KeyValuePairEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(UserWorkspaceEntity)
    private readonly userWorkspaceRepository: Repository<UserWorkspaceEntity>,
  ) {}

  /**
   * Stable, Agora-safe username for a Twenty user within a workspace (length-bounded).
   * Must match chat layout / group provisioning (same inputs).
   */
  scopedUserIdFor(userId: string, workspaceId: string): string {
    const digest = createHash('sha256')
      .update(`${workspaceId}:${userId}`)
      .digest('hex')
      .slice(0, 31);

    return `k${digest}`;
  }

  private buildAppToken(): string {
    const appId = this.configService.get<string>('AGORA_APP_ID') ?? '';
    const appCertificate =
      this.configService.get<string>('AGORA_APP_CERTIFICATE') ?? '';

    return ChatTokenBuilder.buildAppToken(
      appId,
      appCertificate,
      AgoraAuthService.APP_TOKEN_EXPIRE_SECONDS,
    );
  }

  private async registerUserIfNotFound(scopedUserId: string): Promise<void> {
    const orgName = this.configService.get<string>('AGORA_CHAT_ORG_NAME');
    const appName = this.configService.get<string>('AGORA_CHAT_APP_NAME');
    const restHost = this.configService.get<string>('AGORA_CHAT_REST_HOST');

    if (!orgName || !appName || !restHost) {
      this.logger.warn('Missing Agora Chat REST configuration. Registration skipped.');
      return;
    }

    const appId = this.configService.get<string>('AGORA_APP_ID');
    const appCertificate = this.configService.get<string>('AGORA_APP_CERTIFICATE');

    if (!appId || !appCertificate) {
      this.logger.warn('Missing AGORA_APP_ID / AGORA_APP_CERTIFICATE; cannot register chat user.');
      return;
    }

    const appToken = this.buildAppToken();
    const url = `https://${restHost}/${orgName}/${appName}/users`;

    try {
      this.logger.log(`[KONNECCT-AGORA] Registering scoped user: ${scopedUserId}`);

      const response = await firstValueFrom(
        this.httpService.post(
          url,
          {
            username: scopedUserId,
            password: scopedUserId,
          },
          {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${appToken}`,
            },
          },
        ),
      );

      if (response.status === 200 || response.status === 201) {
        this.logger.log(`[KONNECCT-AGORA] User registered: ${scopedUserId}`);
      }
    } catch (error: any) {
      const data = error.response?.data;
      if (
        data?.error === 'duplicate_unique_property_exists' ||
        data?.error_description?.includes?.('already exists')
      ) {
        this.logger.log(`[KONNECCT-AGORA] User already exists: ${scopedUserId}`);
      } else {
        this.logger.warn(
          `[KONNECCT-AGORA] Registration failed for ${scopedUserId}: ${JSON.stringify(data || error.message)}`,
        );
      }
    }
  }

  async ensureChatUserRegistered(scopedUserId: string): Promise<void> {
    await this.registerUserIfNotFound(scopedUserId);
  }

  private async fetchClerkUserEmail(clerkUserId: string): Promise<string | null> {
    const secretKey =
      this.configService.get<string>('CLERK_SECRET_KEY') ??
      process.env.CLERK_SECRET_KEY;
    if (!secretKey) {
      return null;
    }

    try {
      const clerk = createClerkClient({ secretKey });
      const u = await clerk.users.getUser(clerkUserId);
      const primary = u.emailAddresses.find((e) => e.id === u.primaryEmailAddressId);

      return primary?.emailAddress ?? u.emailAddresses[0]?.emailAddress ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Map a Clerk org + user to Twenty (userId, workspaceId) using the same org→workspace
   * mapping as /auth/clerk/exchange, so Agora usernames match group membership.
   */
  async resolveTwentyIdentityForClerkSession(
    clerkUserId: string,
    clerkOrgId: string,
    emailHint?: string,
  ): Promise<{ userId: string; workspaceId: string } | null> {
    const orgKey = `konnecct:clerk:org:${clerkOrgId}:workspaceId`;
    const orgMapping = await this.keyValuePairRepository.findOne({
      where: {
        key: orgKey,
        type: KeyValuePairType.CONFIG_VARIABLE,
        userId: IsNull(),
      },
    });

    const workspaceId = orgMapping?.workspaceId;
    if (!workspaceId) {
      return null;
    }

    let email = emailHint?.toLowerCase().trim();
    if (!email) {
      email = (await this.fetchClerkUserEmail(clerkUserId)) ?? undefined;
    }
    if (!email) {
      return null;
    }

    const user = await this.userRepository.findOne({
      where: { email: email.toLowerCase() },
    });
    if (!user) {
      return null;
    }

    const uw = await this.userWorkspaceRepository.findOne({
      where: { userId: user.id, workspaceId },
    });
    if (!uw) {
      return null;
    }

    return { userId: user.id, workspaceId };
  }

  /**
   * @param userIdentifier — Twenty `user.id` (not workspace member id).
   */
  async getChatUserToken(
    userIdentifier: string,
    workspaceId: string,
  ): Promise<{
    agoraToken: string;
    expiresIn: number;
    userIdentifier: string;
  }> {
    const appId = this.configService.get<string>('AGORA_APP_ID');
    const appCertificate = this.configService.get<string>('AGORA_APP_CERTIFICATE');

    if (!appId || !appCertificate) {
      this.logger.error('Missing AGORA_APP_ID or AGORA_APP_CERTIFICATE env vars.');
      throw new Error('Server configuration error. Missing Agora credentials.');
    }

    const scopedUserId = this.scopedUserIdFor(userIdentifier, workspaceId);

    await this.ensureChatUserRegistered(scopedUserId);

    const expiresInSeconds = AgoraAuthService.CHAT_USER_TOKEN_EXPIRE_SECONDS;
    const token = ChatTokenBuilder.buildUserToken(
      appId,
      appCertificate,
      scopedUserId,
      expiresInSeconds,
    );

    return {
      agoraToken: token,
      expiresIn: expiresInSeconds,
      userIdentifier: scopedUserId,
    };
  }
}
