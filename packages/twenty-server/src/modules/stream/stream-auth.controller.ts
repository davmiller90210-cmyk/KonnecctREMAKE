import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
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

import { StreamAuthService } from './stream-auth.service';

@Controller('stream')
export class StreamAuthController {
  constructor(
    private readonly agoraAuthService: AgoraAuthService,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly streamAuthService: StreamAuthService,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
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

        const user = await this.userRepository.findOne({
          where: { id: String(userId) },
        });

        const name = this.streamAuthService.displayNameFromUser(user);
        const image = user?.defaultAvatarUrl ?? undefined;

        return await this.streamAuthService.createUserToken(scopedUid, {
          name: name || scopedUid,
          ...(image ? { image } : {}),
        });
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

      const uidStr = String(uid);
      const user = await this.userRepository.findOne({
        where: { id: uidStr },
      });
      const name = this.streamAuthService.displayNameFromUser(user);
      const image = user?.defaultAvatarUrl ?? undefined;

      return await this.streamAuthService.createUserToken(uidStr, {
        ...(name ? { name: name || uidStr } : {}),
        ...(image ? { image } : {}),
      });
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

  /**
   * Upserts Stream user records for workspace members (e.g. before creating a DM).
   * Requires the same workspace bearer token as GET /stream/token.
   */
  @Post('ensure-users')
  @HttpCode(HttpStatus.OK)
  async ensureStreamUsers(
    @Req() req: Request,
    @Body() body: { scopedUserIds?: string[] },
  ) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing Authorization header');
    }

    const token = authHeader.split(' ')[1];
    const ids = Array.isArray(body?.scopedUserIds) ? body.scopedUserIds : [];

    if (ids.length === 0) {
      return { ok: true as const, ensured: 0 };
    }

    if (ids.length > 64) {
      throw new BadRequestException('Too many scopedUserIds (max 64)');
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

      await this.streamAuthService.ensureScopedUsersForWorkspace(
        workspaceId,
        ids,
      );

      return { ok: true as const, ensured: ids.length };
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
