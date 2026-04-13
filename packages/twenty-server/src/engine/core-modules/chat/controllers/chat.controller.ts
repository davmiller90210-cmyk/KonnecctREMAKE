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
  Res,
  ServiceUnavailableException,
  UnauthorizedException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { type Request, type Response } from 'express';
import { createHash } from 'crypto';
import { QueryFailedError } from 'typeorm';

import { ChatLayoutService } from 'src/engine/core-modules/chat/services/chat-layout.service';
import { ChatMutationService } from 'src/engine/core-modules/chat/services/chat-mutation.service';
import { MattermostBridgeService } from 'src/engine/core-modules/mattermost/mattermost-bridge.service';

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
    private readonly mattermostBridgeService: MattermostBridgeService,
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

    try {
      return await this.chatLayoutService.getLayout(
        context.workspaceId,
        context.userWorkspaceId,
      );
    } catch (error) {
      this.rethrowIfMissingChatSchema(error, 'GET /chat/layout');
    }
  }

  @Get('mattermost/session')
  @HttpCode(HttpStatus.OK)
  async getMattermostSession(@Req() req: Request) {
    const context = await this.resolveVerifiedAccessContext(req);

    if (!this.mattermostBridgeService.isConfigured()) {
      throw new ServiceUnavailableException(
        'Mattermost bridge is not configured (set MATTERMOST_SITE_URL on crm-server).',
      );
    }

    return this.mattermostBridgeService.getSessionForTwentyUser(context.userId);
  }

  @Post('mattermost/link-token')
  @HttpCode(HttpStatus.OK)
  async linkMattermostPersonalToken(
    @Req() req: Request,
    @Body() body: { token?: string },
  ) {
    const context = await this.resolveVerifiedAccessContext(req);

    if (!this.mattermostBridgeService.isConfigured()) {
      throw new ServiceUnavailableException(
        'Mattermost bridge is not configured (set MATTERMOST_SITE_URL on crm-server).',
      );
    }

    const raw = body?.token;

    if (!raw || typeof raw !== 'string') {
      throw new HttpException('token is required', HttpStatus.BAD_REQUEST);
    }

    await this.mattermostBridgeService.linkPersonalAccessTokenForTwentyUser(
      context.userId,
      raw,
    );

    return { linked: true as const };
  }

  @Post('mattermost/files')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('files', { limits: { fileSize: 52 * 1024 * 1024 } }),
  )
  async uploadMattermostFile(
    @Req() req: Request,
    @UploadedFile()
    file:
      | { buffer: Buffer; originalname: string; mimetype?: string }
      | undefined,
  ) {
    const context = await this.resolveVerifiedAccessContext(req);
    const channelId = (req.body as { channel_id?: string }).channel_id;

    if (!channelId || typeof channelId !== 'string') {
      throw new HttpException('channel_id is required', HttpStatus.BAD_REQUEST);
    }

    if (!file) {
      throw new HttpException(
        'Multipart field "files" is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    return this.mattermostBridgeService.uploadFile(
      context.userId,
      channelId,
      file,
    );
  }

  @Post('mattermost/forward')
  async forwardMattermostV4(
    @Req() req: Request,
    @Res() res: Response,
    @Body()
    body: {
      method?: string;
      path?: string;
      body?: unknown;
    },
  ) {
    const context = await this.resolveVerifiedAccessContext(req);

    if (!body?.path || typeof body.path !== 'string') {
      throw new HttpException('path is required', HttpStatus.BAD_REQUEST);
    }

    const result = await this.mattermostBridgeService.forwardV4(context.userId, {
      method: typeof body.method === 'string' ? body.method : 'GET',
      path: body.path,
      body: body.body,
    });

    if (result.kind === 'json') {
      return res.status(result.status).json(result.data);
    }

    return res.status(result.status).type('text/plain').send(result.text);
  }

  @Get('workspace-members')
  @HttpCode(HttpStatus.OK)
  async getWorkspaceMembers(@Req() req: Request) {
    const context = await this.resolveVerifiedAccessContext(req);

    try {
      return await this.chatLayoutService.getWorkspaceMembersForChat(
        context.workspaceId,
        context.userWorkspaceId,
      );
    } catch (error) {
      this.rethrowIfMissingChatSchema(error, 'GET /chat/workspace-members');
    }
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

  /**
   * When chat tables are not migrated yet, Postgres returns 42P01 (undefined_table).
   * Without this, the client only sees HTTP 500.
   */
  private static isMissingChatTablesError(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) {
      return false;
    }

    const code = (error.driverError as { code?: string } | undefined)?.code;

    if (code !== '42P01') {
      return false;
    }

    const msg = error.message.toLowerCase();

    return (
      msg.includes('chatchannel') ||
      msg.includes('chatcategory') ||
      msg.includes('chatdmthread') ||
      msg.includes('chatdmparticipant') ||
      msg.includes('chatchannelmember')
    );
  }

  private rethrowIfMissingChatSchema(error: unknown, operation: string): never {
    if (ChatController.isMissingChatTablesError(error)) {
      this.logger.error(
        `${operation}: chat tables missing — run DB migrations (e.g. yarn command:prod upgrade).`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new ServiceUnavailableException(
        'Chat is not ready: core database migrations have not created chat tables yet. In the API container run: yarn command:prod upgrade (or yarn command:prod run-typeorm-migration --force if upgrade fails on APP_VERSION). Then reload the app.',
      );
    }

    throw error;
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
