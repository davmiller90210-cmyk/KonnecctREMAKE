import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

import { WorkspaceRelatedEntity } from 'src/engine/workspace-manager/types/workspace-related-entity';

import { type ChatMessageConversationKind } from './chat-message.entity';

@Entity({ name: 'chatPinnedMessage', schema: 'core' })
@Unique('IDX_CHAT_PIN_CONV_MSG', [
  'workspaceId',
  'conversationKind',
  'conversationId',
  'messageId',
])
@Index('IDX_CHAT_PIN_CONVERSATION', [
  'workspaceId',
  'conversationKind',
  'conversationId',
])
export class ChatPinnedMessageEntity extends WorkspaceRelatedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  conversationKind: ChatMessageConversationKind;

  @Column({ type: 'uuid' })
  conversationId: string;

  @Column({ type: 'uuid' })
  messageId: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
