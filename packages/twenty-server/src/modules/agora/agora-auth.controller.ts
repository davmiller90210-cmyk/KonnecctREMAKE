import { Controller, Get, HttpCode, HttpStatus, Logger, NotFoundException, Req, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { createHash } from 'crypto';

import { AgoraAuthService } from './agora-auth.service';

@Controller('agora')
export class AgoraAuthController {
  private readonly logger = new Logger(AgoraAuthController.name);

  constructor(
    private readonly agoraAuthService: AgoraAuthService,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
  ) {}

  @Get('token')
  @HttpCode(HttpStatus.OK)
  async getAgoraToken(@Req() req: Request) {
    this.logger.log('[KONNECCT-AGORA] Received token request');

    // 1. Extract CRM session token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing Authorization header');
    }

    const token = authHeader.split(' ')[1];

    try {
      // 2. Decode auth token (legacy Twenty JWT or Clerk JWT)
      const decodedUnverified = this.jwtService.decode(token) as any;
      if (!decodedUnverified) {
        throw new UnauthorizedException('Invalid payload');
      }

      // Legacy Twenty session token path
      if (decodedUnverified.workspaceId) {
        const workspaceId = decodedUnverified.workspaceId;
        const appSecret = this.configService.get<string>('APP_SECRET');

        if (!appSecret) {
          throw new Error('APP_SECRET is not set');
        }

        // 3. Verify CRM Identity securely
        const secret = createHash('sha256')
          .update(`${appSecret}${workspaceId}ACCESS`)
          .digest('hex');

        const verifiedPayload = await this.jwtService.verifyAsync(token, { secret });
        const workspaceMemberId = verifiedPayload.workspaceMemberId;

        if (!workspaceMemberId) {
          throw new NotFoundException('No workspace member ID found');
        }

        // 4. Issue Agora token natively. (workspaceMemberId becomes the Agora User ID)
        const tokenPayload = await this.agoraAuthService.getChatUserToken(workspaceMemberId, workspaceId);

        this.logger.log(`[KONNECCT-AGORA] Token issued for ${workspaceMemberId} (legacy JWT)`);
        return tokenPayload;
      }

      // Clerk JWT path
      const clerkUserId =
        decodedUnverified.sub ??
        decodedUnverified.userId ??
        decodedUnverified.user_id;
      const clerkOrgId =
        decodedUnverified.org_id ??
        decodedUnverified.orgId ??
        decodedUnverified.organization_id ??
        req.headers['x-clerk-org-id'];

      if (!clerkUserId || !clerkOrgId) {
        throw new UnauthorizedException(
          'Missing Clerk sub/org_id claims for Agora scoping',
        );
      }

      const tokenPayload = await this.agoraAuthService.getChatUserToken(
        String(clerkUserId),
        String(clerkOrgId),
      );

      this.logger.log(`[KONNECCT-AGORA] Token issued for ${clerkUserId} (clerk JWT)`);
      return tokenPayload;
    } catch (error) {
      this.logger.error(`[KONNECCT-AGORA] Verification failed: ${error.message}`);
      throw new UnauthorizedException('Invalid CRM session token');
    }
  }
}
