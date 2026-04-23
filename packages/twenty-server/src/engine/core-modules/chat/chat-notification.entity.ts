import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { WorkspaceRelatedEntity } from 'src/engine/workspace-manager/types/workspace-related-entity';

import { type ChatMessageConversationKind } from './chat-message.entity';

export type ChatNotificationKind = 'channel_message' | 'dm_message';

@Entity({ name: 'chatNotification', schema: 'core' })
@Index('IDX_CHAT_NOTIFICATION_RECIPIENT_CREATED', [
  'workspaceId',
  'recipientUserWorkspaceId',
  'createdAt',
])
export class ChatNotificationEntity extends WorkspaceRelatedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  recipientUserWorkspaceId: string;

  @Column({ type: 'uuid', nullable: true })
  actorUserWorkspaceId: string | null;

  @Column({ type: 'varchar' })
  kind: ChatNotificationKind;

  @Column({ type: 'varchar' })
  conversationKind: ChatMessageConversationKind;

  @Column({ type: 'uuid' })
  conversationId: string;

  @Column({ type: 'uuid' })
  messageId: string;

  @Column({ type: 'varchar', length: 512 })
  bodyPreview: string;

  @Column({ type: 'timestamptz', nullable: true })
  readAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
