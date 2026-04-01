import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatTokenBuilder } from 'agora-token';

@Injectable()
export class AgoraAuthService {
  private readonly logger = new Logger(AgoraAuthService.name);

  constructor(private readonly configService: ConfigService) {}

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

    // Token valid for 24 hours. The frontend SDK should renew before it expires.
    const expiresInSeconds = 24 * 3600; 

    this.logger.log(`Provisioning Agora Chat Token for user: ${userIdentifier}`);

    try {
      // Build the Token007 using the Agora server SDK.
      const token = ChatTokenBuilder.buildUserToken(
        appId,
        appCertificate,
        userIdentifier,
        expiresInSeconds,
      );

      return {
        agoraToken: token,
        expiresIn: expiresInSeconds,
        userIdentifier,
      };
    } catch (error) {
      this.logger.error(`Failed to generate Agora token: ${error.message}`);
      throw new UnauthorizedException('Authentication token generation failed.');
    }
  }
}
