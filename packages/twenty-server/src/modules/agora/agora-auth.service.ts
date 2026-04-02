import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatTokenBuilder } from 'agora-token';

@Injectable()
export class AgoraAuthService {
  private readonly logger = new Logger(AgoraAuthService.name);

  constructor(private readonly configService: ConfigService) {}

  private async registerUserIfNotFound(userIdentifier: string, appId: string, appCertificate: string) {
    const orgName = this.configService.get<string>('AGORA_CHAT_ORG_NAME');
    const appName = this.configService.get<string>('AGORA_CHAT_APP_NAME');
    const restHost = this.configService.get<string>('AGORA_CHAT_REST_HOST');

    if (!orgName || !appName || !restHost) {
      this.logger.warn('Missing Agora Chat REST configuration. Registration skipped.');
      return;
    }

    // Agora usernames must be lowercase alphanumeric
    const agoraUsername = userIdentifier.toLowerCase().replace(/[^a-z0-9]/g, '');

    // 1. Build an App Token (valid for 10 minutes) for administrative REST calls
    const appToken = ChatTokenBuilder.buildAppToken(appId, appCertificate, 600);
    const url = `https://${restHost}/${orgName}/${appName}/users`;

    try {
      this.logger.log(`[KONNECCT-AGORA] Attempting to register user: ${agoraUsername}`);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${appToken}`,
        },
        body: JSON.stringify({
          username: agoraUsername,
          password: agoraUsername, 
        }),
      });

      const data = await response.json() as any;

      if (response.ok) {
        this.logger.log(`[KONNECCT-AGORA] User registered successfully: ${agoraUsername}`);
      } else {
        // Ignore "duplicate_unique_property_exists" error (user already exists)
        if (data?.error === 'duplicate_unique_property_exists' || data?.error_description?.includes('already exists')) {
          this.logger.log(`[KONNECCT-AGORA] User already exists: ${agoraUsername}`);
        } else {
          this.logger.warn(`[KONNECCT-AGORA] Registration failed for ${agoraUsername}. Status: ${response.status}. Error: ${JSON.stringify(data)}`);
        }
      }
    } catch (error) {
      this.logger.error(`[KONNECCT-AGORA] Unexpected registrar error: ${error.message}`);
    }
  }

  /**
   * Generates an Agora Chat User Token for the authenticated user.
   * This is used by the frontend SDK to securely log in directly to Agora.
   */
  async getChatUserToken(userIdentifier: string): Promise<{
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

    // Ensure we use the same normalized ID for registration and token issuance
    const normalizedId = userIdentifier.toLowerCase().replace(/[^a-z0-9]/g, '');

    // ─── Phase 1: Silent Registration ──────────────────────────────────────────
    await this.registerUserIfNotFound(normalizedId, appId, appCertificate);

    // ─── Phase 2: Token Issuance ───────────────────────────────────────────────
    const expiresInSeconds = 24 * 3600; 

    try {
      const token = ChatTokenBuilder.buildUserToken(
        appId,
        appCertificate,
        normalizedId,
        expiresInSeconds,
      );

      return {
        agoraToken: token,
        expiresIn: expiresInSeconds,
        userIdentifier: normalizedId,
      };
    } catch (error) {
      this.logger.error(`Failed to generate Agora token: ${error.message}`);
      throw new UnauthorizedException('Authentication token generation failed.');
    }
  }
}
