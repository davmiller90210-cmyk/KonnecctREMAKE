import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

import {
  ObjectRecordCreateEvent,
  ObjectRecordDeleteEvent,
  ObjectRecordUpdateEvent,
} from 'twenty-shared/database-events';
import { isDefined } from 'twenty-shared/utils';

import { OnDatabaseBatchEvent } from 'src/engine/api/graphql/graphql-query-runner/decorators/on-database-batch-event.decorator';
import { DatabaseEventAction } from 'src/engine/api/graphql/graphql-query-runner/enums/database-event-action';
import { WorkspaceEventBatch } from 'src/engine/workspace-event-emitter/types/workspace-event-batch.type';
import { WorkspaceMemberWorkspaceEntity } from 'src/modules/workspace-member/standard-objects/workspace-member.workspace-entity';

@Injectable()
export class WorkspaceMemberRocketChatSyncListener {
  private readonly logger = new Logger(WorkspaceMemberRocketChatSyncListener.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {}

  private get rocketChatConfig() {
    return {
      url: this.configService.get<string>('VITE_ROCKET_CHAT_URL')?.replace('/chat', '') || 'http://rocketchat:3000',
      adminToken: this.configService.get<string>('ROCKET_CHAT_ADMIN_TOKEN'),
      adminId: this.configService.get<string>('ROCKET_CHAT_ADMIN_ID'),
    };
  }

  @OnDatabaseBatchEvent('workspaceMember', DatabaseEventAction.CREATED)
  async handleCreated(
    payload: WorkspaceEventBatch<ObjectRecordCreateEvent<WorkspaceMemberWorkspaceEntity>>,
  ) {
    for (const event of payload.events) {
      const member = event.properties.after;
      await this.syncUser(member);
    }
  }

  @OnDatabaseBatchEvent('workspaceMember', DatabaseEventAction.UPDATED)
  async handleUpdated(
    payload: WorkspaceEventBatch<ObjectRecordUpdateEvent<WorkspaceMemberWorkspaceEntity>>,
  ) {
    for (const event of payload.events) {
      const member = event.properties.after;
      await this.syncUser(member);
    }
  }

  @OnDatabaseBatchEvent('workspaceMember', DatabaseEventAction.DELETED)
  @OnDatabaseBatchEvent('workspaceMember', DatabaseEventAction.DESTROYED)
  async handleDeleted(
    payload: WorkspaceEventBatch<ObjectRecordDeleteEvent<WorkspaceMemberWorkspaceEntity>>,
  ) {
    for (const event of payload.events) {
      const member = event.properties.before;
      await this.deactivateUser(member);
    }
  }

  private async syncUser(member: WorkspaceMemberWorkspaceEntity) {
    const config = this.rocketChatConfig;
    if (!config.adminToken || !config.adminId) {
      this.logger.warn('Rocket.Chat Admin credentials missing. Skipping sync.');
      return;
    }

    const username = member.userEmail?.split('@')[0] || `user_${member.id}`;
    const name = `${member.name.firstName} ${member.name.lastName}`.trim();

    try {
      // 1. Try to find user by email
      const findResponse = await firstValueFrom(
        this.httpService.get(`${config.url}/api/v1/users.info?email=${member.userEmail}`, {
          headers: { 'X-Auth-Token': config.adminToken, 'X-User-Id': config.adminId },
        })
      );

      if (findResponse.data.success) {
        // Update
        const userId = findResponse.data.user._id;
        await firstValueFrom(
          this.httpService.post(`${config.url}/api/v1/users.update`, {
            userId,
            data: {
              name,
              email: member.userEmail,
              active: true,
              customFields: {
                title: member.dateFormat, // Placeholder for title if not in entity
              }
            }
          }, {
            headers: { 'X-Auth-Token': config.adminToken, 'X-User-Id': config.adminId },
          })
        );
        this.logger.log(`Rocket.Chat user updated: ${member.userEmail}`);
      } else {
        // Create
        await firstValueFrom(
          this.httpService.post(`${config.url}/api/v1/users.create`, {
            name,
            email: member.userEmail,
            username,
            password: Math.random().toString(36).slice(-10),
            verified: true,
            joinDefaultChannels: true,
          }, {
            headers: { 'X-Auth-Token': config.adminToken, 'X-User-Id': config.adminId },
          })
        );
        this.logger.log(`Rocket.Chat user created: ${member.userEmail}`);
      }

      // 2. Set Avatar if available
      if (isDefined(member.avatarUrl)) {
        await firstValueFrom(
          this.httpService.post(`${config.url}/api/v1/users.setAvatar`, {
            email: member.userEmail,
            avatarUrl: member.avatarUrl,
          }, {
            headers: { 'X-Auth-Token': config.adminToken, 'X-User-Id': config.adminId },
          })
        );
      }
    } catch (error) {
      this.logger.error(`Failed to sync Rocket.Chat user ${member.userEmail}: ${error.message}`);
    }
  }

  private async deactivateUser(member: WorkspaceMemberWorkspaceEntity) {
    const config = this.rocketChatConfig;
    if (!config.adminToken || !config.adminId) return;

    try {
      const findResponse = await firstValueFrom(
        this.httpService.get(`${config.url}/api/v1/users.info?email=${member.userEmail}`, {
          headers: { 'X-Auth-Token': config.adminToken, 'X-User-Id': config.adminId },
        })
      );

      if (findResponse.data.success) {
        const userId = findResponse.data.user._id;
        await firstValueFrom(
          this.httpService.post(`${config.url}/api/v1/users.update`, {
            userId,
            data: { active: false }
          }, {
            headers: { 'X-Auth-Token': config.adminToken, 'X-User-Id': config.adminId },
          })
        );
        this.logger.log(`Rocket.Chat user deactivated: ${member.userEmail}`);
      }
    } catch (error) {
      this.logger.error(`Failed to deactivate Rocket.Chat user ${member.userEmail}: ${error.message}`);
    }
  }
}
