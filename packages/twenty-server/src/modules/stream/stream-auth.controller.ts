import {
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  NotFoundException,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash } from 'crypto';
import { Request } from 'express';

import { AgoraAuthService } from 'src/modules/agora/agora-auth.service';

import { StreamAuthService } from './stream-auth.service';

@Controller('stream')
export class StreamAuthController {
  constructor(
    private readonly agoraAuthService: AgoraAuthService,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly streamAuthService: StreamAuthService,
  ) {}

  @Get('token')
  @HttpCode(HttpStatus.OK)
  async getStreamToken(@Req() req: Request) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing Authorization header');
    }

    const token = authHeader.split(' ')[1];

    try {
      const decodedUnverified = this.jwtService.decode(token) as
        | { sub?: string; userId?: string; workspaceId?: string }
        | null;

      if (!decodedUnverified) {
        throw new UnauthorizedException('Invalid session token payload');
      }

      if (decodedUnverified.workspaceId) {
        const workspaceId = decodedUnverified.workspaceId;
        const appSecret = this.configService.get<string>('APP_SECRET');

        if (!appSecret) {
          throw new Error('APP_SECRET is not set');
        }

        const secret = createHash('sha256')
          .update(`${appSecret}${workspaceId}ACCESS`)
          .digest('hex');

        const verifiedPayload = await this.jwtService.verifyAsync(token, {
          secret,
        });
        const userId = verifiedPayload.userId ?? verifiedPayload.sub;

        if (!userId) {
          throw new NotFoundException('No user ID found in workspace token');
        }

        const scopedUid = this.agoraAuthService.scopedUserIdFor(
          String(userId),
          workspaceId,
        );

        return await this.streamAuthService.createUserToken(scopedUid);
      }

      const fallbackHeader = req.headers['x-konnecct-uid-fallback'];
      const fallbackUid = Array.isArray(fallbackHeader)
        ? fallbackHeader[0]
        : fallbackHeader;
      const uid =
        decodedUnverified.userId ??
        decodedUnverified.sub ??
        fallbackUid;

      if (!uid) {
        throw new UnauthorizedException('Could not resolve Stream user id');
      }

      return await this.streamAuthService.createUserToken(String(uid));
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      const message = error instanceof Error ? error.message : String(error);

      throw new UnauthorizedException({
        error: 'Unauthorized',
        message,
        statusCode: HttpStatus.UNAUTHORIZED,
      });
    }
  }
}
