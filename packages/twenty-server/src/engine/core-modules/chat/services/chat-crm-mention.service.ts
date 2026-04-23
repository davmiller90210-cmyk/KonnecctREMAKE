import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CoreObjectNameSingular } from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';
import { type EntityManager, In, Repository } from 'typeorm';

import { buildUserAuthContext } from 'src/engine/core-modules/auth/utils/build-user-auth-context.util';
import { UserWorkspaceEntity } from 'src/engine/core-modules/user-workspace/user-workspace.entity';
import { ChatMessageCrmMentionEntity } from 'src/engine/core-modules/chat/chat-message-crm-mention.entity';
import { buildObjectIdByNameMaps } from 'src/engine/metadata-modules/flat-object-metadata/utils/build-object-id-by-name-maps.util';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { WorkspaceCacheService } from 'src/engine/workspace-cache/services/workspace-cache.service';

export type ChatCrmMentionSnapshotPayload = {
  objectNameSingular: string;
  recordId: string;
  displayName: string;
  objectLabel: string;
  imageUrl: string | null;
  ownerDisplayLabel: string | null;
};

export type ChatCrmMentionSnapshotDTO = ChatCrmMentionSnapshotPayload & {
  restricted?: boolean;
};

type ParsedRecordMention = {
  objectNameSingular: string;
  recordId: string;
};

const RECORD_LINK_IN_BODY_REGEX =
  /\[([^\]]*)\]\(twenty:\/\/record\/([^/)\s]+)\/([^)\s]+)\)/g;

@Injectable()
export class ChatCrmMentionService {
  constructor(
    @InjectRepository(ChatMessageCrmMentionEntity)
    private readonly chatMessageCrmMentionRepository: Repository<ChatMessageCrmMentionEntity>,
    @InjectRepository(UserWorkspaceEntity)
    private readonly userWorkspaceRepository: Repository<UserWorkspaceEntity>,
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
    private readonly workspaceCacheService: WorkspaceCacheService,
  ) {}

  parseRecordMentionsFromBody(body: string): ParsedRecordMention[] {
    const out: ParsedRecordMention[] = [];
    const seen = new Set<string>();

    RECORD_LINK_IN_BODY_REGEX.lastIndex = 0;
    let match: RegExpExecArray | null = RECORD_LINK_IN_BODY_REGEX.exec(body);

    while (match !== null) {
      const objectNameSingular = match[2]?.trim();
      const recordId = match[3]?.trim();

      if (objectNameSingular && recordId) {
        const key = `${objectNameSingular}:${recordId}`;
        if (!seen.has(key)) {
          seen.add(key);
          out.push({ objectNameSingular, recordId });
        }
      }
      match = RECORD_LINK_IN_BODY_REGEX.exec(body);
    }

    return out;
  }

  private async buildAuthContextForUserWorkspace(
    workspaceId: string,
    userWorkspaceId: string,
  ) {
    const userWorkspace = await this.userWorkspaceRepository.findOne({
      where: { id: userWorkspaceId, workspaceId },
      relations: ['workspace', 'user'],
    });

    if (!userWorkspace?.workspace || !userWorkspace.user) {
      return null;
    }

    const { flatWorkspaceMemberMaps } =
      await this.workspaceCacheService.getOrRecompute(workspaceId, [
        'flatWorkspaceMemberMaps',
      ]);

    const workspaceMemberId =
      flatWorkspaceMemberMaps.idByUserId[userWorkspace.userId];
    const workspaceMember = isDefined(workspaceMemberId)
      ? flatWorkspaceMemberMaps.byId[workspaceMemberId]
      : undefined;

    if (!isDefined(workspaceMemberId) || !isDefined(workspaceMember)) {
      return null;
    }

    return buildUserAuthContext({
      workspace: userWorkspace.workspace,
      userWorkspaceId: userWorkspace.id,
      user: userWorkspace.user,
      workspaceMemberId,
      workspaceMember,
    });
  }

  private displayNameFromRecord(record: Record<string, unknown>): string {
    const name = record.name;
    if (typeof name === 'string' && name.trim()) {
      return name.trim();
    }
    if (name && typeof name === 'object' && name !== null) {
      const fn = (name as { firstName?: string }).firstName ?? '';
      const ln = (name as { lastName?: string }).lastName ?? '';
      const full = `${fn} ${ln}`.trim();
      if (full) {
        return full;
      }
    }
    const title = record.title;
    if (typeof title === 'string' && title.trim()) {
      return title.trim();
    }
    return 'Record';
  }

  private imageUrlFromRecord(record: Record<string, unknown>): string | null {
    const avatarUrl = record.avatarUrl;
    if (typeof avatarUrl === 'string' && avatarUrl.trim()) {
      return avatarUrl.trim();
    }
    const avatarFile = record.avatarFile;
    if (Array.isArray(avatarFile) && avatarFile.length > 0) {
      const first = avatarFile[0] as { path?: string; url?: string };
      const url = first?.path ?? first?.url;
      if (typeof url === 'string' && url.trim()) {
        return url.trim();
      }
    }
    return null;
  }

  private ownerLabelFromRecord(record: Record<string, unknown>): string | null {
    const accountOwner = record.accountOwner as
      | { name?: { firstName?: string; lastName?: string } }
      | undefined;
    if (accountOwner?.name) {
      const fn = accountOwner.name.firstName ?? '';
      const ln = accountOwner.name.lastName ?? '';
      const full = `${fn} ${ln}`.trim();
      if (full) {
        return full;
      }
    }
    const owner = record.owner as { name?: string } | undefined;
    if (owner && typeof owner.name === 'string' && owner.name.trim()) {
      return owner.name.trim();
    }
    const assignee = record.assignee as { name?: string } | undefined;
    if (assignee && typeof assignee.name === 'string' && assignee.name.trim()) {
      return assignee.name.trim();
    }
    const createdBy = record.createdBy as { name?: string } | undefined;
    if (createdBy && typeof createdBy.name === 'string' && createdBy.name.trim()) {
      return createdBy.name.trim();
    }
    const company = record.company as { name?: string } | undefined;
    if (company && typeof company.name === 'string' && company.name.trim()) {
      return company.name.trim();
    }
    return null;
  }

  private async loadRecordWithCommonRelations(
    workspaceId: string,
    authContext: ReturnType<typeof buildUserAuthContext>,
    objectNameSingular: string,
    recordId: string,
  ): Promise<Record<string, unknown> | null> {
    return this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        try {
          const repository = await this.globalWorkspaceOrmManager.getRepository<
            Record<string, unknown>
          >(workspaceId, objectNameSingular);

          const record = await repository.findOne({
            where: { id: recordId } as never,
          });

          return record ? (record as unknown as Record<string, unknown>) : null;
        } catch {
          return null;
        }
      },
      authContext,
    );
  }

  /** Public: resolve immutable snapshot if the viewer can read the record (same rules as mentions). */
  async getViewerRecordSnapshot(
    workspaceId: string,
    viewerUserWorkspaceId: string,
    objectNameSingular: string,
    recordId: string,
  ): Promise<ChatCrmMentionSnapshotPayload | null> {
    return this.buildSnapshotPayload(
      workspaceId,
      viewerUserWorkspaceId,
      objectNameSingular,
      recordId,
    );
  }

  /**
   * Resolves the CRM record's owning workspace member to a `userWorkspaceId` for DMs.
   * Uses `accountOwnerId` / `ownerId` / `assigneeId` or `createdBy.workspaceMemberId` when present.
   */
  async resolveRecordOwnerUserWorkspaceId(
    workspaceId: string,
    viewerUserWorkspaceId: string,
    objectNameSingular: string,
    recordId: string,
  ): Promise<string | null> {
    const snapshot = await this.getViewerRecordSnapshot(
      workspaceId,
      viewerUserWorkspaceId,
      objectNameSingular,
      recordId,
    );

    if (!snapshot) {
      return null;
    }

    const authContext = await this.buildAuthContextForUserWorkspace(
      workspaceId,
      viewerUserWorkspaceId,
    );

    if (!authContext) {
      return null;
    }

    const record = await this.loadRecordWithCommonRelations(
      workspaceId,
      authContext,
      objectNameSingular,
      recordId,
    );

    if (!record) {
      return null;
    }

    const workspaceMemberId =
      this.extractWorkspaceMemberIdFromRecord(record);

    if (!workspaceMemberId) {
      return null;
    }

    const userId = await this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        try {
          const repo = await this.globalWorkspaceOrmManager.getRepository<{
            userId: string;
          }>(workspaceId, CoreObjectNameSingular.WorkspaceMember);

          const row = await repo.findOne({
            where: { id: workspaceMemberId } as never,
          });

          return row?.userId ?? null;
        } catch {
          return null;
        }
      },
      authContext,
    );

    if (!userId) {
      return null;
    }

    const userWorkspace = await this.userWorkspaceRepository.findOne({
      where: { workspaceId, userId },
    });

    return userWorkspace?.id ?? null;
  }

  private extractWorkspaceMemberIdFromRecord(
    record: Record<string, unknown>,
  ): string | null {
    const pickUuid = (key: string): string | null => {
      const value = record[key];

      return typeof value === 'string' && value.trim() ? value.trim() : null;
    };

    const fromActor = (key: string): string | null => {
      const actor = record[key];

      if (!actor || typeof actor !== 'object') {
        return null;
      }

      const workspaceMemberId = (
        actor as { workspaceMemberId?: string | null }
      ).workspaceMemberId;

      return typeof workspaceMemberId === 'string' && workspaceMemberId.trim()
        ? workspaceMemberId.trim()
        : null;
    };

    return (
      pickUuid('accountOwnerId') ??
      pickUuid('ownerId') ??
      pickUuid('assigneeId') ??
      fromActor('createdBy')
    );
  }

  private async buildSnapshotPayload(
    workspaceId: string,
    actorUserWorkspaceId: string,
    objectNameSingular: string,
    recordId: string,
  ): Promise<ChatCrmMentionSnapshotPayload | null> {
    const authContext = await this.buildAuthContextForUserWorkspace(
      workspaceId,
      actorUserWorkspaceId,
    );

    if (!authContext) {
      return null;
    }

    const { flatObjectMetadataMaps } =
      await this.workspaceCacheService.getOrRecompute(workspaceId, [
        'flatObjectMetadataMaps',
      ]);
    const { idByNameSingular } = buildObjectIdByNameMaps(flatObjectMetadataMaps);
    const objectMetadataId = idByNameSingular[objectNameSingular];

    if (!isDefined(objectMetadataId)) {
      return null;
    }

    const objectMetadata =
      flatObjectMetadataMaps.byId[objectMetadataId] ?? undefined;

    if (!objectMetadata) {
      return null;
    }

    const record = await this.loadRecordWithCommonRelations(
      workspaceId,
      authContext,
      objectNameSingular,
      recordId,
    );

    if (!record) {
      return null;
    }

    return {
      objectNameSingular,
      recordId,
      displayName: this.displayNameFromRecord(record),
      objectLabel: objectMetadata.labelSingular,
      imageUrl: this.imageUrlFromRecord(record),
      ownerDisplayLabel: this.ownerLabelFromRecord(record),
    };
  }

  async replaceMentionsForMessage(
    manager: EntityManager,
    input: {
      workspaceId: string;
      actorUserWorkspaceId: string;
      messageId: string;
      body: string;
    },
  ): Promise<void> {
    const repo = manager.getRepository(ChatMessageCrmMentionEntity);

    await repo.delete({
      workspaceId: input.workspaceId,
      messageId: input.messageId,
    });

    const mentions = this.parseRecordMentionsFromBody(input.body);

    for (const mention of mentions) {
      const snapshot = await this.buildSnapshotPayload(
        input.workspaceId,
        input.actorUserWorkspaceId,
        mention.objectNameSingular,
        mention.recordId,
      );

      if (!snapshot) {
        continue;
      }

      await repo.save(
        repo.create({
          workspaceId: input.workspaceId,
          messageId: input.messageId,
          objectNameSingular: snapshot.objectNameSingular,
          linkedRecordId: snapshot.recordId,
          snapshotPayload: JSON.stringify(snapshot),
          actorUserWorkspaceId: input.actorUserWorkspaceId,
        }),
      );
    }
  }

  async buildSnapshotMapFromRows(input: {
    workspaceId: string;
    viewerUserWorkspaceId: string;
    rows: ChatMessageCrmMentionEntity[];
  }): Promise<Map<string, ChatCrmMentionSnapshotDTO[]>> {
    const result = new Map<string, ChatCrmMentionSnapshotDTO[]>();

    const viewerAuth = await this.buildAuthContextForUserWorkspace(
      input.workspaceId,
      input.viewerUserWorkspaceId,
    );

    for (const row of input.rows) {
      let payload: ChatCrmMentionSnapshotPayload;

      try {
        payload = JSON.parse(row.snapshotPayload) as ChatCrmMentionSnapshotPayload;
      } catch {
        continue;
      }

      let restricted = false;

      if (viewerAuth) {
        const canSee = await this.loadRecordWithCommonRelations(
          input.workspaceId,
          viewerAuth,
          payload.objectNameSingular,
          payload.recordId,
        );
        restricted = !canSee;
      } else {
        restricted = true;
      }

      const dto: ChatCrmMentionSnapshotDTO = restricted
        ? {
            objectNameSingular: payload.objectNameSingular,
            recordId: payload.recordId,
            displayName: '',
            objectLabel: payload.objectLabel,
            imageUrl: null,
            ownerDisplayLabel: null,
            restricted: true,
          }
        : { ...payload };

      const list = result.get(row.messageId) ?? [];
      list.push(dto);
      result.set(row.messageId, list);
    }

    return result;
  }

  async loadMentionSnapshotsForViewer(input: {
    workspaceId: string;
    viewerUserWorkspaceId: string;
    messageIds: string[];
    manager?: EntityManager;
  }): Promise<Map<string, ChatCrmMentionSnapshotDTO[]>> {
    if (input.messageIds.length === 0) {
      return new Map();
    }

    const repo = input.manager
      ? input.manager.getRepository(ChatMessageCrmMentionEntity)
      : this.chatMessageCrmMentionRepository;

    const rows = await repo.find({
      where: {
        workspaceId: input.workspaceId,
        messageId: In(input.messageIds),
      },
      order: { createdAt: 'ASC' },
    });

    return this.buildSnapshotMapFromRows({
      workspaceId: input.workspaceId,
      viewerUserWorkspaceId: input.viewerUserWorkspaceId,
      rows,
    });
  }
}
