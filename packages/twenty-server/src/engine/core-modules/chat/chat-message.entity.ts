import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { WorkspaceRelatedEntity } from 'src/engine/workspace-manager/types/workspace-related-entity';

export type ChatMessageConversationKind = 'channel' | 'dm';
export type ChatMessageKind = 'text' | 'system';

@Entity({ name: 'chatMessage', schema: 'core' })
@Index('IDX_CHAT_MESSAGE_WORKSPACE_CONVERSATION_CREATED_AT', [
  'workspaceId',
  'conversationKind',
  'conversationId',
  'createdAt',
])
export class ChatMessageEntity extends WorkspaceRelatedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  conversationKind: ChatMessageConversationKind;

  @Column({ type: 'uuid' })
  conversationId: string;

  @Column({ type: 'uuid', nullable: true })
  senderUserWorkspaceId: string | null;

  @Column({ type: 'varchar' })
  kind: ChatMessageKind;

  @Column({ type: 'text' })
  body: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  editedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
