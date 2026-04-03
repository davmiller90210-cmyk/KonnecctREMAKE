import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { createHash } from 'crypto';
import { firstValueFrom } from 'rxjs';
import { ChatTokenBuilder } from 'agora-token';

@Injectable()
export class AgoraAuthService {
  private readonly logger = new Logger(AgoraAuthService.name);

  private static readonly APP_TOKEN_EXPIRE_SECONDS = 3600;

  /**
   * Agora Chat rejects long usernames (e.g. ws{32hex}u{32hex} > limit). Use a short,
   * deterministic id per (workspace, user) so registration + Chat user token stay aligned.
   */
  private buildScopedChatUsername(
    normalizedWorkspaceId: string,
    normalizedUserId: string,
  ): string {
    const digest = createHash('sha256')
      .update(`${normalizedWorkspaceId}\x1e${normalizedUserId}`, 'utf8')
      .digest('hex');
    // Leading letter — some stacks are picky; 32 chars total, well under Agora limits.
    return `k${digest.slice(0, 31)}`;
  }

  /** Deterministic Agora Chat username for a CRM user in a workspace (matches token + REST). */
  scopedUserIdFor(userIdentifier: string, workspaceId: string): string {
    const normalizedUserId = userIdentifier.toLowerCase().replace(/[^a-z0-9]/g, '');
    const normalizedWorkspaceId = workspaceId
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');

    return this.buildScopedChatUsername(normalizedWorkspaceId, normalizedUserId);
  }

  /** Ensures the user exists in Agora Chat (REST registration) before group ops. */
  async ensureChatUserRegistered(scopedUserId: string): Promise<void> {
    const appId = this.configService.get<string>('AGORA_APP_ID');
    const appCertificate = this.configService.get<string>('AGORA_APP_CERTIFICATE');

    if (!appId || !appCertificate) {
      return;
    }

    await this.registerUserIfNotFound(scopedUserId, appId, appCertificate);
  }

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {}

  private async registerUserIfNotFound(
    scopedUserId: string,
    appId: string,
    appCertificate: string,
  ) {
    const orgName = this.configService.get<string>('AGORA_CHAT_ORG_NAME');
    const appName = this.configService.get<string>('AGORA_CHAT_APP_NAME');
    const restHost = this.configService.get<string>('AGORA_CHAT_REST_HOST');

    if (!orgName || !appName || !restHost) {
      this.logger.warn('Missing Agora Chat REST configuration. Registration skipped.');
      return;
    }

    const appToken = ChatTokenBuilder.buildAppToken(
      appId,
      appCertificate,
      AgoraAuthService.APP_TOKEN_EXPIRE_SECONDS,
    );
    const url = `https://${restHost}/${orgName}/${appName}/users`;

    try {
      this.logger.log(`[KONNECCT-AGORA] Attempting to register scoped user: ${scopedUserId}`);

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
        this.logger.log(`[KONNECCT-AGORA] User registered successfully: ${scopedUserId}`);
      }
    } catch (error) {
      const data = error.response?.data;
      if (
        data?.error === 'duplicate_unique_property_exists' ||
        data?.error_description?.includes('already exists')
      ) {
        this.logger.log(`[KONNECCT-AGORA] User already exists: ${scopedUserId}`);
      } else {
        this.logger.warn(
          `[KONNECCT-AGORA] Registration failed for ${scopedUserId}. Error: ${JSON.stringify(data || error.message)}`,
        );
      }
    }
  }

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

    const normalizedUserId = userIdentifier.toLowerCase().replace(/[^a-z0-9]/g, '');
    const normalizedWorkspaceId = workspaceId.toLowerCase().replace(/[^a-z0-9]/g, '');
    const scopedUserId = this.buildScopedChatUsername(
      normalizedWorkspaceId,
      normalizedUserId,
    );

    await this.registerUserIfNotFound(scopedUserId, appId, appCertificate);

    const expiresInSeconds = 24 * 3600;

    try {
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
    } catch (error) {
      this.logger.error(`Failed to generate Agora token: ${error.message}`);
      throw new UnauthorizedException('Authentication token generation failed.');
    }
  }
}
