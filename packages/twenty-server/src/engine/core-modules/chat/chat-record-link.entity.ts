import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

import { WorkspaceRelatedEntity } from 'src/engine/workspace-manager/types/workspace-related-entity';

import { type ChatMessageConversationKind } from './chat-message.entity';

@Entity({ name: 'chatRecordLink', schema: 'core' })
@Index('IDX_CHAT_RECORD_LINK_WORKSPACE_RECORD', [
  'workspaceId',
  'linkedObjectNameSingular',
  'linkedRecordId',
])
@Index('IDX_CHAT_RECORD_LINK_WORKSPACE_CONVERSATION', [
  'workspaceId',
  'conversationKind',
  'conversationId',
])
export class ChatRecordLinkEntity extends WorkspaceRelatedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  conversationKind: ChatMessageConversationKind;

  @Column({ type: 'uuid' })
  conversationId: string;

  @Column({ type: 'varchar' })
  linkedObjectNameSingular: string;

  @Column({ type: 'uuid' })
  linkedRecordId: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
