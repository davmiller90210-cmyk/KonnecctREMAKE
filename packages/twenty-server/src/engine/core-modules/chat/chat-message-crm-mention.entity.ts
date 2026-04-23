import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { WorkspaceRelatedEntity } from 'src/engine/workspace-manager/types/workspace-related-entity';

import { ChatMessageEntity } from './chat-message.entity';

@Entity({ name: 'chatMessageCrmMention', schema: 'core' })
@Index('IDX_CHAT_MESSAGE_CRM_MENTION_MESSAGE', ['messageId'])
@Index('IDX_CHAT_MESSAGE_CRM_MENTION_WORKSPACE_RECORD', [
  'workspaceId',
  'objectNameSingular',
  'linkedRecordId',
])
export class ChatMessageCrmMentionEntity extends WorkspaceRelatedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  messageId: string;

  @ManyToOne(() => ChatMessageEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'messageId' })
  message: ChatMessageEntity;

  @Column({ type: 'varchar' })
  objectNameSingular: string;

  @Column({ type: 'uuid' })
  linkedRecordId: string;

  /** Immutable JSON snapshot at post time (displayName, objectLabel, imageUrl, ownerDisplayLabel). */
  @Column({ type: 'text' })
  snapshotPayload: string;

  @Column({ type: 'uuid' })
  actorUserWorkspaceId: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
