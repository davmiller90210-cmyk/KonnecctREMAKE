import {
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Logger,
  NotFoundException,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
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
        const userId =
          verifiedPayload.userId ??
          verifiedPayload.sub;

        if (!userId) {
          throw new NotFoundException('No user ID found in workspace token');
        }

        // Agora scoped ids are derived from Twenty userId + workspaceId (matches chat groups / layout).
        const tokenPayload = await this.agoraAuthService.getChatUserToken(
          String(userId),
          workspaceId,
        );

        this.logger.log(`[KONNECCT-AGORA] Token issued for user ${userId} (legacy JWT)`);
        return tokenPayload;
      }

      // Clerk JWT path
      const clerkUserId =
        decodedUnverified.sub ??
        decodedUnverified.userId ??
        decodedUnverified.user_id;
      const orgHeader = req.headers['x-clerk-org-id'];
      const orgFromHeader = Array.isArray(orgHeader)
        ? orgHeader[0]
        : orgHeader;

      const clerkOrgId =
        decodedUnverified.org_id ??
        decodedUnverified.orgId ??
        decodedUnverified.organization_id ??
        orgFromHeader;

      if (!clerkUserId || !clerkOrgId) {
        throw new UnauthorizedException(
          'Missing Clerk sub/org_id claims for Agora scoping',
        );
      }

      const emailHint =
        typeof decodedUnverified.email === 'string'
          ? decodedUnverified.email
          : typeof decodedUnverified.email_address === 'string'
            ? decodedUnverified.email_address
            : undefined;

      const resolved = await this.agoraAuthService.resolveTwentyIdentityForClerkSession(
        String(clerkUserId),
        String(clerkOrgId),
        emailHint,
      );

      if (!resolved) {
        throw new UnauthorizedException(
          'Could not map Clerk session to a workspace user. Open the app so /auth/clerk/exchange can run, then retry.',
        );
      }

      const tokenPayload = await this.agoraAuthService.getChatUserToken(
        resolved.userId,
        resolved.workspaceId,
      );

      this.logger.log(
        `[KONNECCT-AGORA] Token issued for user ${resolved.userId} (Clerk session → Twenty)`,
      );
      return tokenPayload;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);

      this.logger.error(`[KONNECCT-AGORA] Verification failed: ${message}`);

      if (error instanceof HttpException) {
        throw error;
      }

      // Ensure we always return JSON error instead of letting NestJS/Nginx fall back to HTML
      throw new UnauthorizedException({
        statusCode: HttpStatus.UNAUTHORIZED,
        message: message.includes('Missing Agora') || message.includes('AGORA_APP')
          ? 'Agora is not configured on the server (check AGORA_APP_ID / AGORA_APP_CERTIFICATE).'
          : 'Invalid CRM session token',
        error: 'Unauthorized'
      });
    }
  }
}
