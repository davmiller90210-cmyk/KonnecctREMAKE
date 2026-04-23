import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Logger,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { type Request, type Response } from 'express';
import { createHash } from 'crypto';
import { QueryFailedError, Repository } from 'typeorm';

import { ChatLayoutService } from 'src/engine/core-modules/chat/services/chat-layout.service';
import { ChatMutationService } from 'src/engine/core-modules/chat/services/chat-mutation.service';
import { ChatMessageService } from 'src/engine/core-modules/chat/services/chat-message.service';
import { ChatNotificationService } from 'src/engine/core-modules/chat/services/chat-notification.service';
import { ChatGiphyService } from 'src/engine/core-modules/chat/services/chat-giphy.service';
import { ChatRealtimeService } from 'src/engine/core-modules/chat/services/chat-realtime.service';
import { ChatCrmMentionService } from 'src/engine/core-modules/chat/services/chat-crm-mention.service';
import { extractMentionedUserWorkspaceIdsFromChatBody } from 'src/engine/core-modules/chat/utils/extract-mentioned-user-workspace-ids-from-chat-body.util';
import { UserWorkspaceEntity } from 'src/engine/core-modules/user-workspace/user-workspace.entity';
import { WorkspaceEventEmitter } from 'src/engine/workspace-event-emitter/workspace-event-emitter';

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
    private readonly chatMessageService: ChatMessageService,
    private readonly chatNotificationService: ChatNotificationService,
    private readonly chatRealtimeService: ChatRealtimeService,
    private readonly chatGiphyService: ChatGiphyService,
    private readonly chatCrmMentionService: ChatCrmMentionService,
    private readonly workspaceEventEmitter: WorkspaceEventEmitter,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    @InjectRepository(UserWorkspaceEntity)
    private readonly userWorkspaceRepository: Repository<UserWorkspaceEntity>,
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

  @Get('notifications')
  @HttpCode(HttpStatus.OK)
  async listNotifications(
    @Req() req: Request,
    @Query('limit') limitRaw?: string,
  ) {
    const context = await this.resolveVerifiedAccessContext(req);
    const limit =
      typeof limitRaw === 'string' ? Number.parseInt(limitRaw, 10) : undefined;

    try {
      return await this.chatNotificationService.listForRecipient({
        workspaceId: context.workspaceId,
        recipientUserWorkspaceId: context.userWorkspaceId,
        limit: Number.isFinite(limit) ? limit : undefined,
      });
    } catch (error) {
      this.rethrowIfMissingChatSchema(error, 'GET /chat/notifications');
    }
  }

  @Post('notifications/read-all')
  @HttpCode(HttpStatus.OK)
  async markAllNotificationsRead(@Req() req: Request) {
    const context = await this.resolveVerifiedAccessContext(req);

    try {
      const result = await this.chatNotificationService.markAllRead(
        context.workspaceId,
        context.userWorkspaceId,
      );
      this.chatRealtimeService.publishInbox(
        context.workspaceId,
        context.userWorkspaceId,
        { type: 'notification-updated' },
      );
      return result;
    } catch (error) {
      this.rethrowIfMissingChatSchema(error, 'POST /chat/notifications/read-all');
    }
  }

  @Post('notifications/read')
  @HttpCode(HttpStatus.OK)
  async markNotificationsRead(
    @Req() req: Request,
    @Body() body: { ids?: string[] },
  ) {
    const context = await this.resolveVerifiedAccessContext(req);
    const ids = Array.isArray(body?.ids) ? body.ids : [];

    try {
      const result = await this.chatNotificationService.markReadByIds(
        context.workspaceId,
        context.userWorkspaceId,
        ids,
      );
      this.chatRealtimeService.publishInbox(
        context.workspaceId,
        context.userWorkspaceId,
        { type: 'notification-updated' },
      );
      return result;
    } catch (error) {
      this.rethrowIfMissingChatSchema(error, 'POST /chat/notifications/read');
    }
  }

  @Get('notifications/stream')
  async streamNotifications(@Req() req: Request, @Res() res: Response) {
    const context = await this.resolveVerifiedAccessContext(req);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    res.write(': connected\n\n');

    const unsubscribe = this.chatRealtimeService.subscribeInbox(
      context.workspaceId,
      context.userWorkspaceId,
      (event) => {
        res.write(`event: ${event.type}\n`);
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      },
    );

    const heartbeat = setInterval(() => {
      res.write(': heartbeat\n\n');
    }, 25000);

    req.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
      res.end();
    });
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

  @Get('channels/:channelId/roster')
  @HttpCode(HttpStatus.OK)
  async getChannelRoster(
    @Req() req: Request,
    @Param('channelId') channelId: string,
  ) {
    const context = await this.resolveVerifiedAccessContext(req);

    try {
      await this.chatMessageService.assertConversationReadable({
        workspaceId: context.workspaceId,
        userWorkspaceId: context.userWorkspaceId,
        conversation: { kind: 'channel', id: channelId },
      });

      return await this.chatLayoutService.getChannelRosterMembers(
        context.workspaceId,
        channelId,
      );
    } catch (error) {
      this.rethrowIfMissingChatSchema(
        error,
        'GET /chat/channels/:channelId/roster',
      );
    }
  }

  @Get('dm/:dmThreadId/roster')
  @HttpCode(HttpStatus.OK)
  async getDmThreadRoster(
    @Req() req: Request,
    @Param('dmThreadId') dmThreadId: string,
  ) {
    const context = await this.resolveVerifiedAccessContext(req);

    try {
      await this.chatMessageService.assertConversationReadable({
        workspaceId: context.workspaceId,
        userWorkspaceId: context.userWorkspaceId,
        conversation: { kind: 'dm', id: dmThreadId },
      });

      return await this.chatLayoutService.getDmThreadRosterMembers(
        context.workspaceId,
        dmThreadId,
      );
    } catch (error) {
      this.rethrowIfMissingChatSchema(error, 'GET /chat/dm/:dmThreadId/roster');
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
      throw new HttpException(
        'visibility must be public or private',
        HttpStatus.BAD_REQUEST,
      );
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

  @Post('typing')
  @HttpCode(HttpStatus.OK)
  async postTyping(
    @Req() req: Request,
    @Body()
    body: {
      channelId?: string;
      dmThreadId?: string;
      active?: boolean;
    },
  ) {
    const context = await this.resolveVerifiedAccessContext(req);
    const conversation = this.resolveConversationRef(body);

    await this.chatMessageService.assertConversationReadable({
      workspaceId: context.workspaceId,
      userWorkspaceId: context.userWorkspaceId,
      conversation,
    });

    const uw = await this.userWorkspaceRepository.findOne({
      where: {
        id: context.userWorkspaceId,
        workspaceId: context.workspaceId,
      },
      relations: ['user'],
    });

    const nickname =
      [uw?.user?.firstName, uw?.user?.lastName].filter(Boolean).join(' ').trim() ||
      'Member';

    this.chatRealtimeService.publish(conversation.kind, conversation.id, {
      type: 'typing',
      userWorkspaceId: context.userWorkspaceId,
      active: body.active !== false,
      nickname,
    });

    return { ok: true as const };
  }

  @Get('messages')
  @HttpCode(HttpStatus.OK)
  async getMessages(
    @Req() req: Request,
    @Query()
    body: {
      channelId?: string;
      dmThreadId?: string;
      limit?: number | string;
      after?: string;
    },
  ) {
    const context = await this.resolveVerifiedAccessContext(req);
    const conversation = this.resolveConversationRef(body);

    return this.chatMessageService.listMessages({
      workspaceId: context.workspaceId,
      userWorkspaceId: context.userWorkspaceId,
      conversation,
      limit:
        typeof body.limit === 'string'
          ? Number.parseInt(body.limit, 10)
          : body.limit,
      after: body.after,
    });
  }

  @Get('pins')
  @HttpCode(HttpStatus.OK)
  async listPins(
    @Req() req: Request,
    @Query()
    query: {
      channelId?: string;
      dmThreadId?: string;
    },
  ) {
    const context = await this.resolveVerifiedAccessContext(req);
    const conversation = this.resolveConversationRef(query);

    try {
      return await this.chatMessageService.listPinnedMessages({
        workspaceId: context.workspaceId,
        userWorkspaceId: context.userWorkspaceId,
        conversation,
      });
    } catch (error) {
      this.rethrowIfMissingChatSchema(error, 'GET /chat/pins');
    }
  }

  @Get('gifs/search')
  @HttpCode(HttpStatus.OK)
  async searchGifs(
    @Req() req: Request,
    @Query('q') q?: string,
    @Query('limit') limitRaw?: string,
  ) {
    await this.resolveVerifiedAccessContext(req);
    const parsed =
      typeof limitRaw === 'string' ? Number.parseInt(limitRaw, 10) : 24;

    return this.chatGiphyService.searchGifs(
      q ?? '',
      Number.isFinite(parsed) ? parsed : 24,
    );
  }

  @Get('gifs/trending')
  @HttpCode(HttpStatus.OK)
  async trendingGifs(
    @Req() req: Request,
    @Query('limit') limitRaw?: string,
  ) {
    await this.resolveVerifiedAccessContext(req);
    const parsed =
      typeof limitRaw === 'string' ? Number.parseInt(limitRaw, 10) : 24;

    return this.chatGiphyService.trendingGifs(
      Number.isFinite(parsed) ? parsed : 24,
    );
  }

  @Post('messages')
  @HttpCode(HttpStatus.CREATED)
  async postMessage(
    @Req() req: Request,
    @Body()
    body: {
      channelId?: string;
      dmThreadId?: string;
      body?: string;
    },
  ) {
    const context = await this.resolveVerifiedAccessContext(req);
    const conversation = this.resolveConversationRef(body);

    if (!body.body?.trim()) {
      throw new HttpException('body is required', HttpStatus.BAD_REQUEST);
    }

    const trimmedBody = body.body.trim();

    const message = await this.chatMessageService.postMessage({
      workspaceId: context.workspaceId,
      userWorkspaceId: context.userWorkspaceId,
      conversation,
      body: trimmedBody,
    });

    this.chatRealtimeService.publishMessageCreated({
      conversationKind: conversation.kind,
      conversationId: conversation.id,
      messageId: message.id,
      createdAt: new Date(message.createdAt),
    });

    const mentionedUserWorkspaceIds =
      extractMentionedUserWorkspaceIdsFromChatBody(trimmedBody);
    const channelMentionRestrict =
      conversation.kind === 'channel' && mentionedUserWorkspaceIds.length > 0
        ? mentionedUserWorkspaceIds
        : undefined;

    void (async () => {
      try {
        const { recipientUserWorkspaceIds } =
          await this.chatNotificationService.notifyNewMessage({
            workspaceId: context.workspaceId,
            conversation,
            messageId: message.id,
            senderUserWorkspaceId: context.userWorkspaceId,
            body: trimmedBody,
            restrictRecipientsToUserWorkspaceIds: channelMentionRestrict,
          });
        for (const recipientUserWorkspaceId of recipientUserWorkspaceIds) {
          this.chatRealtimeService.publishInbox(
            context.workspaceId,
            recipientUserWorkspaceId,
            {
              type: 'notification-updated',
              conversationKind: conversation.kind,
              conversationId: conversation.id,
              reason: 'new-message',
            },
          );
        }
        this.chatRealtimeService.publishInbox(
          context.workspaceId,
          context.userWorkspaceId,
          {
            type: 'notification-updated',
            conversationKind: conversation.kind,
            conversationId: conversation.id,
            reason: 'new-message',
          },
        );
      } catch (error: unknown) {
        this.logger.warn(
          `Chat notification fan-out failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    })();

    this.workspaceEventEmitter.emitCustomBatchEvent(
      'chat_message_created',
      [
        {
          messageId: message.id,
          conversationKind: conversation.kind,
          conversationId: conversation.id,
          senderUserWorkspaceId: context.userWorkspaceId,
          bodyPreview: trimmedBody.slice(0, 500),
          crmMentionSnapshots: message.crmMentionSnapshots ?? [],
        },
      ],
      context.workspaceId,
    );

    return message;
  }

  @Patch('messages/:messageId')
  @HttpCode(HttpStatus.OK)
  async patchMessage(
    @Req() req: Request,
    @Param('messageId') messageId: string,
    @Body() body: { body?: string },
  ) {
    const context = await this.resolveVerifiedAccessContext(req);

    if (!body.body?.trim()) {
      throw new HttpException('body is required', HttpStatus.BAD_REQUEST);
    }

    try {
      const updated = await this.chatMessageService.updateMessageText({
        workspaceId: context.workspaceId,
        userWorkspaceId: context.userWorkspaceId,
        messageId,
        body: body.body,
      });

      this.chatRealtimeService.publish(
        updated.conversationKind,
        updated.conversationId,
        { type: 'message-updated', messageId: updated.id },
      );

      this.fanoutLayoutRefreshForConversation(
        context.workspaceId,
        {
          kind: updated.conversationKind,
          id: updated.conversationId,
        },
        'message-edited',
      );

      return updated;
    } catch (error) {
      this.rethrowIfMissingChatSchema(error, 'PATCH /chat/messages/:messageId');
    }
  }

  @Delete('messages/:messageId')
  @HttpCode(HttpStatus.OK)
  async deleteChatMessage(
    @Req() req: Request,
    @Param('messageId') messageId: string,
  ) {
    const context = await this.resolveVerifiedAccessContext(req);

    try {
      const conversation = await this.chatMessageService.softDeleteMessage({
        workspaceId: context.workspaceId,
        userWorkspaceId: context.userWorkspaceId,
        messageId,
      });

      this.chatRealtimeService.publish(conversation.kind, conversation.id, {
        type: 'message-updated',
        messageId,
      });

      this.fanoutLayoutRefreshForConversation(
        context.workspaceId,
        conversation,
        'message-deleted',
      );

      return { ok: true as const };
    } catch (error) {
      this.rethrowIfMissingChatSchema(
        error,
        'DELETE /chat/messages/:messageId',
      );
    }
  }

  @Post('messages/:messageId/reactions')
  @HttpCode(HttpStatus.OK)
  async addMessageReaction(
    @Req() req: Request,
    @Param('messageId') messageId: string,
    @Body() body: { emoji?: string },
  ) {
    const context = await this.resolveVerifiedAccessContext(req);

    if (!body?.emoji?.trim()) {
      throw new HttpException('emoji is required', HttpStatus.BAD_REQUEST);
    }

    try {
      const conversation = await this.chatMessageService.addMessageReaction({
        workspaceId: context.workspaceId,
        userWorkspaceId: context.userWorkspaceId,
        messageId,
        emoji: body.emoji,
      });

      this.chatRealtimeService.publish(
        conversation.kind,
        conversation.id,
        { type: 'reactions-updated' },
      );

      return { ok: true as const };
    } catch (error) {
      this.rethrowIfMissingChatSchema(error, 'POST /chat/messages/:messageId/reactions');
    }
  }

  @Delete('messages/:messageId/reactions')
  @HttpCode(HttpStatus.OK)
  async removeMessageReaction(
    @Req() req: Request,
    @Param('messageId') messageId: string,
    @Query('emoji') emoji?: string,
  ) {
    const context = await this.resolveVerifiedAccessContext(req);

    if (!emoji?.trim()) {
      throw new HttpException('emoji is required', HttpStatus.BAD_REQUEST);
    }

    try {
      const conversation = await this.chatMessageService.removeMessageReaction({
        workspaceId: context.workspaceId,
        userWorkspaceId: context.userWorkspaceId,
        messageId,
        emoji,
      });

      this.chatRealtimeService.publish(
        conversation.kind,
        conversation.id,
        { type: 'reactions-updated' },
      );

      return { ok: true as const };
    } catch (error) {
      this.rethrowIfMissingChatSchema(
        error,
        'DELETE /chat/messages/:messageId/reactions',
      );
    }
  }

  @Post('messages/:messageId/pin')
  @HttpCode(HttpStatus.OK)
  async pinMessage(
    @Req() req: Request,
    @Param('messageId') messageId: string,
  ) {
    const context = await this.resolveVerifiedAccessContext(req);

    try {
      const conversation = await this.chatMessageService.pinMessage({
        workspaceId: context.workspaceId,
        userWorkspaceId: context.userWorkspaceId,
        messageId,
      });

      this.chatRealtimeService.publish(
        conversation.kind,
        conversation.id,
        { type: 'pins-updated' },
      );

      return { ok: true as const };
    } catch (error) {
      this.rethrowIfMissingChatSchema(error, 'POST /chat/messages/:messageId/pin');
    }
  }

  @Delete('messages/:messageId/pin')
  @HttpCode(HttpStatus.OK)
  async unpinMessage(
    @Req() req: Request,
    @Param('messageId') messageId: string,
  ) {
    const context = await this.resolveVerifiedAccessContext(req);

    try {
      const conversation = await this.chatMessageService.unpinMessage({
        workspaceId: context.workspaceId,
        userWorkspaceId: context.userWorkspaceId,
        messageId,
      });

      this.chatRealtimeService.publish(
        conversation.kind,
        conversation.id,
        { type: 'pins-updated' },
      );

      return { ok: true as const };
    } catch (error) {
      this.rethrowIfMissingChatSchema(
        error,
        'DELETE /chat/messages/:messageId/pin',
      );
    }
  }

  @Get('messages/stream')
  async streamMessages(
    @Req() req: Request,
    @Res() res: Response,
    @Query()
    body: {
      channelId?: string;
      dmThreadId?: string;
    },
  ) {
    const context = await this.resolveVerifiedAccessContext(req);
    const conversation = this.resolveConversationRef(body);

    await this.chatMessageService.assertConversationReadable({
      workspaceId: context.workspaceId,
      userWorkspaceId: context.userWorkspaceId,
      conversation,
    });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    res.write(': connected\n\n');

    const unsubscribe = this.chatRealtimeService.subscribe(
      conversation.kind,
      conversation.id,
      (event) => {
        res.write(`event: ${event.type}\n`);
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      },
    );

    const heartbeat = setInterval(() => {
      res.write(': heartbeat\n\n');
    }, 25000);

    req.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
      res.end();
    });
  }

  @Post('messages/read')
  @HttpCode(HttpStatus.OK)
  async markConversationRead(
    @Req() req: Request,
    @Body()
    body: {
      channelId?: string;
      dmThreadId?: string;
      upToMessageId?: string;
    },
  ) {
    const context = await this.resolveVerifiedAccessContext(req);
    const conversation = this.resolveConversationRef(body);

    const result = await this.chatMessageService.markConversationAsRead({
      workspaceId: context.workspaceId,
      userWorkspaceId: context.userWorkspaceId,
      conversation,
      upToMessageId: body.upToMessageId,
    });

    this.chatRealtimeService.publish(conversation.kind, conversation.id, {
      type: 'read-updated',
      userWorkspaceId: context.userWorkspaceId,
      lastReadAt: result.lastReadAt,
    });

    return result;
  }

  @Get('record-links')
  @HttpCode(HttpStatus.OK)
  async listRecordChatLinks(
    @Req() req: Request,
    @Query('objectNameSingular') objectNameSingular?: string,
    @Query('recordId') recordId?: string,
  ) {
    const context = await this.resolveVerifiedAccessContext(req);

    if (!objectNameSingular?.trim() || !recordId?.trim()) {
      throw new HttpException(
        'objectNameSingular and recordId are required',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      return await this.chatMessageService.listRecordChatLinks({
        workspaceId: context.workspaceId,
        userWorkspaceId: context.userWorkspaceId,
        objectNameSingular: objectNameSingular.trim(),
        recordId: recordId.trim(),
      });
    } catch (error) {
      this.rethrowIfMissingChatSchema(error, 'GET /chat/record-links');
    }
  }

  @Post('records/discussion-channel')
  @HttpCode(HttpStatus.CREATED)
  async startRecordDiscussionChannel(
    @Req() req: Request,
    @Body() body: { objectNameSingular?: string; recordId?: string },
  ) {
    const context = await this.resolveVerifiedAccessContext(req);

    if (!body.objectNameSingular?.trim() || !body.recordId?.trim()) {
      throw new HttpException(
        'objectNameSingular and recordId are required',
        HttpStatus.BAD_REQUEST,
      );
    }

    const objectNameSingular = body.objectNameSingular.trim();
    const recordId = body.recordId.trim();

    try {
      const snapshot = await this.chatCrmMentionService.getViewerRecordSnapshot(
        context.workspaceId,
        context.userWorkspaceId,
        objectNameSingular,
        recordId,
      );

      if (!snapshot) {
        throw new ForbiddenException('You cannot access this record.');
      }

      const { id: channelId, slug } =
        await this.chatMutationService.startRecordDiscussionChannel({
          workspaceId: context.workspaceId,
          creatorUserId: context.userId,
          creatorUserWorkspaceId: context.userWorkspaceId,
          recordDisplayName: snapshot.displayName,
        });

      const linkResult = await this.chatMessageService.linkConversationToRecord(
        {
          workspaceId: context.workspaceId,
          userWorkspaceId: context.userWorkspaceId,
          conversation: { kind: 'channel', id: channelId },
          objectNameSingular,
          recordId,
        },
      );

      if (linkResult.recordLinkCreated) {
        this.fanoutRecordLinksChanged(
          context.workspaceId,
          { kind: 'channel', id: channelId },
          objectNameSingular,
          recordId,
        );
      }

      return { channelId, slug };
    } catch (error) {
      this.rethrowIfMissingChatSchema(error, 'POST /chat/records/discussion-channel');
    }
  }

  @Post('records/dm-with-owner')
  @HttpCode(HttpStatus.CREATED)
  async startDmWithRecordOwner(
    @Req() req: Request,
    @Body() body: { objectNameSingular?: string; recordId?: string },
  ) {
    const context = await this.resolveVerifiedAccessContext(req);

    if (!body.objectNameSingular?.trim() || !body.recordId?.trim()) {
      throw new HttpException(
        'objectNameSingular and recordId are required',
        HttpStatus.BAD_REQUEST,
      );
    }

    const objectNameSingular = body.objectNameSingular.trim();
    const recordId = body.recordId.trim();

    try {
      const ownerUserWorkspaceId =
        await this.chatCrmMentionService.resolveRecordOwnerUserWorkspaceId(
          context.workspaceId,
          context.userWorkspaceId,
          objectNameSingular,
          recordId,
        );

      if (!ownerUserWorkspaceId) {
        throw new BadRequestException(
          'No workspace owner or assignee is set on this record.',
        );
      }

      if (ownerUserWorkspaceId === context.userWorkspaceId) {
        throw new BadRequestException(
          'You cannot start a direct message with yourself as the record owner.',
        );
      }

      const { threadId } =
        await this.chatMutationService.openOrCreateDirectThread({
          workspaceId: context.workspaceId,
          userWorkspaceId: context.userWorkspaceId,
          peerUserWorkspaceId: ownerUserWorkspaceId,
        });

      const linkResult = await this.chatMessageService.linkConversationToRecord(
        {
          workspaceId: context.workspaceId,
          userWorkspaceId: context.userWorkspaceId,
          conversation: { kind: 'dm', id: threadId },
          objectNameSingular,
          recordId,
        },
      );

      if (linkResult.recordLinkCreated) {
        this.fanoutRecordLinksChanged(
          context.workspaceId,
          { kind: 'dm', id: threadId },
          objectNameSingular,
          recordId,
        );
      }

      return { dmThreadId: threadId };
    } catch (error) {
      this.rethrowIfMissingChatSchema(error, 'POST /chat/records/dm-with-owner');
    }
  }

  @Post('record-link')
  @HttpCode(HttpStatus.OK)
  async linkConversationToRecord(
    @Req() req: Request,
    @Body()
    body: {
      channelId?: string;
      dmThreadId?: string;
      objectNameSingular?: string;
      recordId?: string;
    },
  ) {
    const context = await this.resolveVerifiedAccessContext(req);
    const conversation = this.resolveConversationRef(body);

    if (!body.objectNameSingular?.trim() || !body.recordId?.trim()) {
      throw new HttpException(
        'objectNameSingular and recordId are required',
        HttpStatus.BAD_REQUEST,
      );
    }

    const result = await this.chatMessageService.linkConversationToRecord({
      workspaceId: context.workspaceId,
      userWorkspaceId: context.userWorkspaceId,
      conversation,
      objectNameSingular: body.objectNameSingular.trim(),
      recordId: body.recordId.trim(),
    });

    if (result.recordLinkCreated) {
      this.fanoutRecordLinksChanged(
        context.workspaceId,
        conversation,
        body.objectNameSingular.trim(),
        body.recordId.trim(),
      );
    }

    return result;
  }

  private fanoutLayoutRefreshForConversation(
    workspaceId: string,
    conversation: { kind: 'channel' | 'dm'; id: string },
    reason: 'message-edited' | 'message-deleted',
  ): void {
    void this.chatNotificationService
      .listConversationMemberUserWorkspaceIds({
        workspaceId,
        conversation,
      })
      .then((memberIds) => {
        for (const userWorkspaceId of memberIds) {
          this.chatRealtimeService.publishInbox(workspaceId, userWorkspaceId, {
            type: 'notification-updated',
            conversationKind: conversation.kind,
            conversationId: conversation.id,
            reason,
          });
        }
      })
      .catch(() => {});
  }

  private fanoutRecordLinksChanged(
    workspaceId: string,
    conversation: { kind: 'channel' | 'dm'; id: string },
    objectNameSingular: string,
    recordId: string,
  ): void {
    void this.chatNotificationService
      .listConversationMemberUserWorkspaceIds({
        workspaceId,
        conversation,
      })
      .then((memberIds) => {
        for (const userWorkspaceId of memberIds) {
          this.chatRealtimeService.publishInbox(workspaceId, userWorkspaceId, {
            type: 'notification-updated',
            reason: 'record-links-changed',
            objectNameSingular,
            recordId,
            conversationKind: conversation.kind,
            conversationId: conversation.id,
          });
        }
      })
      .catch(() => {});
  }

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
      msg.includes('chatchannelmember') ||
      msg.includes('chatnotification')
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

  private resolveConversationRef(body: {
    channelId?: string;
    dmThreadId?: string;
  }): { kind: 'channel' | 'dm'; id: string } {
    if (body.channelId && body.dmThreadId) {
      throw new HttpException(
        'Provide either channelId or dmThreadId',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (body.channelId) {
      return { kind: 'channel', id: body.channelId };
    }

    if (body.dmThreadId) {
      return { kind: 'dm', id: body.dmThreadId };
    }

    throw new HttpException(
      'channelId or dmThreadId is required',
      HttpStatus.BAD_REQUEST,
    );
  }
}
