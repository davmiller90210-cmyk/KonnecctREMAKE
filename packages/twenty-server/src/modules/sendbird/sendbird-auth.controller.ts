import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Logger,
  NotFoundException,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import { Request } from 'express';
import { Repository } from 'typeorm';

import { UserEntity } from 'src/engine/core-modules/user/user.entity';
import { AgoraAuthService } from 'src/modules/agora/agora-auth.service';

import { SendbirdChatProvisionService } from './sendbird-chat-provision.service';
import { SendbirdPlatformService } from './sendbird-platform.service';

@Controller('sendbird')
export class SendbirdAuthController {
  private readonly logger = new Logger(SendbirdAuthController.name);

  constructor(
    private readonly agoraAuthService: AgoraAuthService,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly sendbirdPlatform: SendbirdPlatformService,
    private readonly sendbirdChatProvision: SendbirdChatProvisionService,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
  ) {}

  @Get('session')
  @HttpCode(HttpStatus.OK)
  async getSession(@Req() req: Request) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing Authorization header');
    }

    if (!this.sendbirdPlatform.isConfigured) {
      throw new BadRequestException(
        'Sendbird is not configured (SENDBIRD_APPLICATION_ID, SENDBIRD_API_TOKEN).',
      );
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

        const user = await this.userRepository.findOne({
          where: { id: String(userId) },
        });

        const name =
          [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() ||
          user?.email?.trim() ||
          scopedUid;

        await this.sendbirdPlatform.ensureUser({
          userId: scopedUid,
          nickname: name,
          ...(user?.defaultAvatarUrl
            ? { profileUrl: user.defaultAvatarUrl }
            : {}),
        });

        const session = await this.sendbirdPlatform.issueSessionToken(scopedUid);

        return {
          appId: this.configService.get<string>('SENDBIRD_APPLICATION_ID')?.trim(),
          userId: scopedUid,
          sessionToken: session.token,
          expiresAt: session.expires_at,
        };
      }

      throw new BadRequestException('Workspace-scoped token required for Sendbird');
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      const detail = error instanceof Error ? error.message : String(error);

      this.logger.warn(`Sendbird session error: ${detail}`);

      throw new BadRequestException(
        'Could not connect to workspace chat. Your account will be synced automatically; if this continues, ask an admin to verify Sendbird settings (and profile image URLs allowed by Sendbird).',
      );
    }
  }

  @Post('ensure-users')
  @HttpCode(HttpStatus.OK)
  async ensureUsers(
    @Req() req: Request,
    @Body() body: { scopedUserIds?: string[] },
  ) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing Authorization header');
    }

    if (!this.sendbirdPlatform.isConfigured) {
      return { ok: true as const, ensured: 0 };
    }

    const token = authHeader.split(' ')[1];
    const ids = Array.isArray(body?.scopedUserIds) ? body.scopedUserIds : [];

    if (ids.length === 0) {
      return { ok: true as const, ensured: 0 };
    }

    if (ids.length > 100) {
      throw new BadRequestException('Too many scopedUserIds (max 100)');
    }

    try {
      const decodedUnverified = this.jwtService.decode(token) as
        | { workspaceId?: string }
        | null;

      const workspaceId = decodedUnverified?.workspaceId;

      if (!workspaceId) {
        throw new BadRequestException(
          'Workspace token required for ensure-users',
        );
      }

      const appSecret = this.configService.get<string>('APP_SECRET');

      if (!appSecret) {
        throw new Error('APP_SECRET is not set');
      }

      const secret = createHash('sha256')
        .update(`${appSecret}${workspaceId}ACCESS`)
        .digest('hex');

      await this.jwtService.verifyAsync(token, { secret });

      const unique = [...new Set(ids)];

      await this.sendbirdChatProvision.ensureSendbirdUsersForScopedIds(
        workspaceId,
        unique,
      );

      return { ok: true as const, ensured: unique.length };
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
