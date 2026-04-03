import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Logger,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { type Request } from 'express';
import { createHash } from 'crypto';

import { ChatLayoutService } from 'src/engine/core-modules/chat/services/chat-layout.service';
import { ChatMutationService } from 'src/engine/core-modules/chat/services/chat-mutation.service';

type VerifiedAccessPayload = {
  sub?: string;
  userId?: string;
  workspaceId: string;
  userWorkspaceId: string;
};

@Controller('chat')
export class ChatController {
  private readonly logger = new Logger(ChatController.name);

  constructor(
    private readonly chatLayoutService: ChatLayoutService,
    private readonly chatMutationService: ChatMutationService,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
  ) {}

  @Post('categories')
  @HttpCode(HttpStatus.CREATED)
  async createCategory(
    @Req() req: Request,
    @Body() body: { name: string },
  ) {
    const context = await this.resolveVerifiedAccessContext(req);

    if (!body?.name?.trim()) {
      throw new HttpException('name is required', HttpStatus.BAD_REQUEST);
    }

    return this.chatMutationService.createWorkspaceCategory({
      workspaceId: context.workspaceId,
      userWorkspaceId: context.userWorkspaceId,
      name: body.name,
    });
  }

  @Get('layout')
  @HttpCode(HttpStatus.OK)
  async getLayout(@Req() req: Request) {
    const context = await this.resolveVerifiedAccessContext(req);

    return this.chatLayoutService.getLayout(
      context.workspaceId,
      context.userWorkspaceId,
    );
  }

  @Get('workspace-members')
  @HttpCode(HttpStatus.OK)
  async getWorkspaceMembers(@Req() req: Request) {
    const context = await this.resolveVerifiedAccessContext(req);

    return this.chatLayoutService.getWorkspaceMembersForChat(
      context.workspaceId,
      context.userWorkspaceId,
    );
  }

  @Post('channels')
  @HttpCode(HttpStatus.CREATED)
  async createChannel(
    @Req() req: Request,
    @Body()
    body: {
      categoryId: string;
      name: string;
      visibility: 'public' | 'private';
      inviteUserWorkspaceIds?: string[];
    },
  ) {
    const context = await this.resolveVerifiedAccessContext(req);

    if (!body?.categoryId || !body?.name?.trim()) {
      throw new HttpException(
        'categoryId and name are required',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (body.visibility !== 'public' && body.visibility !== 'private') {
      throw new HttpException('visibility must be public or private', HttpStatus.BAD_REQUEST);
    }

    return this.chatMutationService.createWorkspaceChannel({
      workspaceId: context.workspaceId,
      creatorUserId: context.userId,
      creatorUserWorkspaceId: context.userWorkspaceId,
      categoryId: body.categoryId,
      name: body.name,
      visibility: body.visibility,
      inviteUserWorkspaceIds: body.inviteUserWorkspaceIds,
    });
  }

  @Post('dm/direct')
  @HttpCode(HttpStatus.OK)
  async openDirect(
    @Req() req: Request,
    @Body() body: { peerUserWorkspaceId: string },
  ) {
    const context = await this.resolveVerifiedAccessContext(req);

    if (!body?.peerUserWorkspaceId) {
      throw new HttpException(
        'peerUserWorkspaceId is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    return this.chatMutationService.openOrCreateDirectThread({
      workspaceId: context.workspaceId,
      userWorkspaceId: context.userWorkspaceId,
      peerUserWorkspaceId: body.peerUserWorkspaceId,
    });
  }

  private async resolveVerifiedAccessContext(
    req: Request,
  ): Promise<VerifiedAccessPayload> {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing Authorization header');
    }

    const token = authHeader.split(' ')[1];

    try {
      const decodedUnverified = this.jwtService.decode(token) as
        | VerifiedAccessPayload
        | null;

      if (!decodedUnverified?.workspaceId) {
        throw new UnauthorizedException(
          'Konnecct chat requires an active CRM session token (workspace scope).',
        );
      }

      const appSecret = this.configService.get<string>('APP_SECRET');

      if (!appSecret) {
        throw new Error('APP_SECRET is not set');
      }

      const secret = createHash('sha256')
        .update(`${appSecret}${decodedUnverified.workspaceId}ACCESS`)
        .digest('hex');

      const verifiedPayload = (await this.jwtService.verifyAsync(token, {
        secret,
      })) as VerifiedAccessPayload;

      if (!verifiedPayload.userWorkspaceId) {
        throw new UnauthorizedException('Missing userWorkspaceId in session token');
      }

      const userId =
        verifiedPayload.userId ?? verifiedPayload.sub ?? '';

      if (!userId) {
        throw new UnauthorizedException('Missing user id in session token');
      }

      return {
        workspaceId: verifiedPayload.workspaceId,
        userWorkspaceId: verifiedPayload.userWorkspaceId,
        userId,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);

      this.logger.warn(`[KONNECCT-CHAT] Auth failed: ${message}`);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new UnauthorizedException('Invalid CRM session token');
    }
  }
}
