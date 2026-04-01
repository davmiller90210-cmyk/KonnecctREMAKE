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
      // 2. Decode JWT
      const decodedUnverified = this.jwtService.decode(token) as any;
      if (!decodedUnverified || !decodedUnverified.workspaceId) {
        throw new UnauthorizedException('Invalid payload');
      }

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
      const tokenPayload = await this.agoraAuthService.getChatUserToken(workspaceMemberId);

      this.logger.log(`[KONNECCT-AGORA] Token issued for ${workspaceMemberId}`);
      return tokenPayload;
    } catch (error) {
      this.logger.error(`[KONNECCT-AGORA] Verification failed: ${error.message}`);
      throw new UnauthorizedException('Invalid CRM session token');
    }
  }
}
